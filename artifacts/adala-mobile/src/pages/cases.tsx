import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scale, Search, Plus, X, Filter, Briefcase } from "lucide-react";

const API = "/api";
const fetchJson = (path: string) => fetch(`${API}${path}`).then(r => r.json());

const STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة", in_progress: "قيد التنفيذ", closed: "مغلقة",
};
const CASE_TYPE: Record<string, string> = {
  civil: "مدني", criminal: "جنائي", commercial: "تجاري",
  family: "أسري", administrative: "إداري", labor: "عمالي", other: "أخرى",
};
const FILTERS = [
  { value: "", label: "الكل" },
  { value: "open", label: "مفتوحة" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "closed", label: "مغلقة" },
];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function Cases() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases", statusFilter],
    queryFn: () => fetchJson(`/cases${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

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
              {search ? "جرب كلمة بحث مختلفة" : "لم يتم إضافة أي قضايا بعد"}
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
                <div className="flex items-center gap-4 mr-11">
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
