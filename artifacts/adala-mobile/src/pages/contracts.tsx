import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, X, CheckCircle2, Clock, AlertCircle, FilePlus } from "lucide-react";

const API = "/api";
const fetchJson = (path: string) => fetch(`${API}${path}`).then(r => r.json());

const STATUS_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  draft:     { label: "مسودة",  color: "bg-muted/50 text-muted-foreground",  dot: "bg-gray-400" },
  review:    { label: "مراجعة", color: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400" },
  signed:    { label: "موقع",   color: "bg-green-500/15 text-green-400",     dot: "bg-green-400" },
  expired:   { label: "منتهي",  color: "bg-red-500/15 text-red-400",         dot: "bg-red-400" },
  cancelled: { label: "ملغي",   color: "bg-muted/50 text-muted-foreground",  dot: "bg-gray-400" },
};

const TYPE_LABEL: Record<string, string> = {
  general: "عام", employment: "توظيف", service: "خدمة",
  nda: "سرية", real_estate: "عقاري", partnership: "شراكة",
};

const FILTERS = [
  { value: "", label: "الكل" },
  { value: "draft", label: "مسودة" },
  { value: "review", label: "مراجعة" },
  { value: "signed", label: "موقع" },
  { value: "expired", label: "منتهي" },
];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function Contracts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts-mobile", statusFilter],
    queryFn: () => fetchJson(`/contracts${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const list = Array.isArray(contracts) ? contracts : [];
  const filtered = list.filter((c: any) =>
    !search || c.title?.includes(search)
  );

  const signed  = list.filter((c: any) => c.status === "signed").length;
  const pending = list.filter((c: any) => ["draft","review"].includes(c.status)).length;
  const expired = list.filter((c: any) => c.status === "expired").length;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "موقعة", value: signed, icon: CheckCircle2, color: "text-green-400 bg-green-500/15" },
          { label: "معلقة",  value: pending, icon: Clock,        color: "text-amber-400 bg-amber-500/15" },
          { label: "منتهية", value: expired, icon: AlertCircle,  color: "text-red-400 bg-red-500/15" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card rounded-2xl p-3 border border-border/50 flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={15} />
            </div>
            <span className="text-lg font-bold text-foreground">{value}</span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث في العقود..."
          className="w-full h-10 pr-9 pl-9 rounded-xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground tap-effect">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors tap-effect ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{filtered.length} عقد</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 border border-border/50 text-center">
          <FilePlus size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground font-medium">لا توجد عقود</p>
          <p className="text-xs text-muted-foreground mt-1 opacity-70">أضف عقودك من النسخة المكتبية</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status, color: "bg-muted/50 text-muted-foreground", dot: "bg-gray-400" };
            const aiPill = c.ai_generated ? (
              <span className="text-[9px] bg-violet-500/15 text-violet-400 border border-violet-500/20 rounded-full px-1.5 py-0.5">AI</span>
            ) : null;
            return (
              <div key={c.id} className="bg-card rounded-2xl px-4 py-3.5 border border-border/50">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={16} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">{c.title}</span>
                      {aiPill}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">{TYPE_LABEL[c.type] ?? c.type}</span>
                      {c.risk_score && (
                        <span className={`text-[10px] font-medium ${
                          c.risk_score === "high" ? "text-red-400" : c.risk_score === "medium" ? "text-amber-400" : "text-green-400"
                        }`}>
                          خطورة: {c.risk_score === "high" ? "عالية" : c.risk_score === "medium" ? "متوسطة" : "منخفضة"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                        {st.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="h-2" />
    </div>
  );
}
