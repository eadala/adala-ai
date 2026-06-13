import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, Users, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const API = "/api";

export default function NewClient() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    fullName: "", type: "individual", phone: "", email: "", notes: "",
  });

  const mutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${API}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("تم إضافة الموكل بنجاح ✅");
      nav("/clients");
    },
    onError: () => toast.error("حدث خطأ أثناء الإضافة"),
  });

  const handleSubmit = () => {
    if (!form.fullName.trim()) { toast.error("أدخل اسم الموكل"); return; }
    mutation.mutate(form);
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-12 pb-4 safe-top flex items-center gap-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center tap-effect">
          <ArrowRight size={18} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Users size={16} className="text-violet-400" />
          </div>
          <h1 className="text-lg font-bold text-foreground">موكل جديد</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">الاسم الكامل *</label>
          <input
            value={form.fullName}
            onChange={e => set("fullName", e.target.value)}
            placeholder="مثال: أحمد محمد العمري"
            className="w-full bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
          />
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">نوع الموكل</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "individual", label: "فرد" },
              { value: "company",    label: "شركة" },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => set("type", t.value)}
                className={`py-3 rounded-2xl text-sm font-semibold border transition-all tap-effect ${
                  form.type === t.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">رقم الجوال</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set("phone", e.target.value)}
            placeholder="05xxxxxxxx"
            dir="ltr"
            className="w-full bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors text-right"
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">البريد الإلكتروني</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set("email", e.target.value)}
            placeholder="example@domain.com"
            dir="ltr"
            className="w-full bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors text-right"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">ملاحظات</label>
          <textarea
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="أي معلومات إضافية..."
            rows={4}
            className="w-full bg-muted border border-border rounded-2xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors resize-none"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="px-4 pb-8 pt-3 border-t border-border bg-card safe-bottom">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending || !form.fullName.trim()}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm tap-effect disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : <Users size={16} />}
          {mutation.isPending ? "جارٍ الإضافة..." : "إضافة الموكل"}
        </button>
      </div>
    </div>
  );
}
