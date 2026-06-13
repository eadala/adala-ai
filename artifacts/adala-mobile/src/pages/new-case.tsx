import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, Scale, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const API = "/api";
const CASE_TYPES = [
  { value: "civil",          label: "مدني" },
  { value: "criminal",       label: "جنائي" },
  { value: "commercial",     label: "تجاري" },
  { value: "family",         label: "أسري" },
  { value: "administrative", label: "إداري" },
  { value: "labor",          label: "عمالي" },
  { value: "real_estate",    label: "عقاري" },
  { value: "other",          label: "أخرى" },
];

export default function NewCase() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", clientId: "", caseType: "civil", description: "", nextHearing: "",
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["clients"],
    queryFn: () => fetch(`${API}/clients`).then(r => r.json()),
  });

  const mutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${API}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("تم إنشاء القضية بنجاح ✅");
      nav("/cases");
    },
    onError: () => toast.error("حدث خطأ أثناء الإنشاء"),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error("أدخل عنوان القضية"); return; }
    mutation.mutate({ ...form, status: "open" });
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-12 pb-4 safe-top flex items-center gap-3">
        <button onClick={() => window.history.back()} className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center tap-effect">
          <ArrowRight size={18} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Scale size={16} className="text-blue-400" />
          </div>
          <h1 className="text-lg font-bold text-foreground">قضية جديدة</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">عنوان القضية *</label>
          <input
            value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="مثال: قضية عمالية — شركة النور"
            className="w-full bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
          />
        </div>

        {/* Case Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">نوع القضية</label>
          <div className="relative">
            <select
              value={form.caseType}
              onChange={e => set("caseType", e.target.value)}
              className="w-full appearance-none bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
            >
              {CASE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Client */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">الموكل</label>
          <div className="relative">
            <select
              value={form.clientId}
              onChange={e => set("clientId", e.target.value)}
              className="w-full appearance-none bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
            >
              <option value="">اختر موكلاً (اختياري)</option>
              {(Array.isArray(clients) ? clients : []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.full_name ?? c.fullName}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Next Hearing */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">تاريخ الجلسة القادمة</label>
          <input
            type="date"
            value={form.nextHearing}
            onChange={e => set("nextHearing", e.target.value)}
            className="w-full bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">ملاحظات</label>
          <textarea
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="وصف مختصر للقضية..."
            rows={4}
            className="w-full bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors resize-none"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="px-4 pb-8 pt-3 border-t border-border bg-card safe-bottom">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending || !form.title.trim()}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm tap-effect disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : <Scale size={16} />}
          {mutation.isPending ? "جارٍ الإنشاء..." : "إنشاء القضية"}
        </button>
      </div>
    </div>
  );
}
