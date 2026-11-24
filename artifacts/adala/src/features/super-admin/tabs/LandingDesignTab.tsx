 
 
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, Loader2, Layout, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const VARIANTS = [
  {
    id: "original",
    name: "الأصلية",
    desc: "الصفحة الرئيسية الحالية — تصميم متكامل بكل الأقسام",
    badge: "الحالية",
    badgeColor: "#64748B",
    preview: `${BASE}/?preview=original`,
    thumb: {
      bg: "#F8FAFC",
      accent: "#1A56DB",
      lines: ["الرئيسية التقليدية","أقسام متعددة","محتوى غني"],
    },
  },
  {
    id: "bento",
    name: "Bento — بساطة Notion",
    desc: "بينتو جريد فاتح، بطاقات ملوّنة، تايبوغرافي حاد — مستوحى من Notion + Linear",
    badge: "جديد",
    badgeColor: "#7C3AED",
    preview: `${BASE}/?preview=bento`,
    thumb: {
      bg: "#F8FAFC",
      accent: "#1A56DB",
      lines: ["بينتو جريد","بطاقات مميّزة","نظيف وبسيط"],
    },
  },
  {
    id: "stripe",
    name: "Stripe — شرائح تفاعلية",
    desc: "أبيض ناصع، تابز تفاعلية لعرض المميزات، معاينة التطبيق داخل الصفحة — مستوحى من Stripe + Linear",
    badge: "جديد",
    badgeColor: "#059669",
    preview: `${BASE}/?preview=stripe`,
    thumb: {
      bg: "#FFFFFF",
      accent: "#1A56DB",
      lines: ["تابز تفاعلية","لقطة التطبيق","خطوط جريئة"],
    },
  },
  {
    id: "hubspot",
    name: "HubSpot — داشبورد ضخم",
    desc: "داشبورد كامل في الهيرو، أرقام ثقة، شبكة مميزات، شهادات موكّلين — مستوحى من HubSpot + Stripe",
    badge: "جديد",
    badgeColor: "#D97706",
    preview: `${BASE}/?preview=hubspot`,
    thumb: {
      bg: "#FFFFFF",
      accent: "#1A56DB",
      lines: ["داشبورد كامل","أرقام ثقة","شهادات العملاء"],
    },
  },
];

function VariantThumb({ v, active }: { v: typeof VARIANTS[0]; active: boolean }) {
  return (
    <div style={{
      width: "100%", aspectRatio: "16/9", borderRadius: 10, overflow: "hidden",
      background: v.thumb.bg, border: `2px solid ${active ? v.thumb.accent : "#E2E8F0"}`,
      position: "relative", transition: "border-color 0.2s",
      boxShadow: active ? `0 0 0 3px ${v.thumb.accent}22` : "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      {/* Mini nav */}
      <div style={{ height: 22, background: v.thumb.bg, borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 8px", gap: 4 }}>
        <div style={{ width: 12, height: 6, borderRadius: 3, background: v.thumb.accent, opacity: 0.9 }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 28, height: 6, borderRadius: 3, background: "#E2E8F0" }} />
        <div style={{ width: 18, height: 6, borderRadius: 3, background: v.thumb.accent, opacity: 0.7 }} />
      </div>
      {/* Hero block */}
      <div style={{ padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ width: "70%", height: 8, borderRadius: 4, background: "#0F172A", opacity: 0.85 }} />
        <div style={{ width: "55%", height: 8, borderRadius: 4, background: v.thumb.accent, opacity: 0.8 }} />
        <div style={{ width: "80%", height: 5, borderRadius: 3, background: "#E2E8F0", marginTop: 2 }} />
        <div style={{ width: "60%", height: 5, borderRadius: 3, background: "#E2E8F0" }} />
      </div>
      {/* Content blocks */}
      <div style={{ padding: "4px 10px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        {["#EFF6FF","#F0FDF4","#F5F3FF"].map((bg, i) => (
          <div key={i} style={{ height: 32, borderRadius: 6, background: bg, border: "1px solid #E2E8F0" }} />
        ))}
      </div>
      {/* Active indicator */}
      {active && (
        <div style={{
          position: "absolute", top: 6, left: 6,
          width: 20, height: 20, borderRadius: "50%",
          background: v.thumb.accent, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={11} color="#fff" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

export function LandingDesignTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const qc = useQueryClient();
  const [previewing, setPreviewing] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ variant: string }>({
    queryKey: ["landing-variant"],
    queryFn: () => authFetch(`${BASE}/api/admin/landing-variant`, {
      headers: { "Content-Type": "application/json" },
    }).then(r => r.json()),
    staleTime: 1000 * 30,
  });

  const active = data?.variant ?? "original";

  const { mutate: activate, isPending } = useMutation({
    mutationFn: (variant: string) =>
      authFetch(`${BASE}/api/admin/landing-variant`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant }),
      }).then(r => r.json()),
    onSuccess: (_, variant) => {
      qc.setQueryData(["landing-variant"], { variant });
      toast({ title: "✅ تم التفعيل", description: `تصميم "${VARIANTS.find(v=>v.id===variant)?.name}" مفعّل الآن` });
    },
    onError: () => toast({ title: "خطأ", description: "تعذّر حفظ التصميم", variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Layout className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold">تصميم الصفحة الرئيسية</h2>
          <p className="text-xs text-muted-foreground">اختر التصميم الذي يظهر لزوار موقعك — التغيير فوري</p>
        </div>
        <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
          <Sparkles size={12} />
          <span>التصميم النشط الآن: <strong className="text-foreground">{VARIANTS.find(v=>v.id===active)?.name}</strong></span>
        </div>
      </div>

      {/* Variants grid */}
      <div className="grid grid-cols-2 gap-5">
        {VARIANTS.map(v => (
          <div key={v.id} className={`rounded-2xl border-2 p-4 transition-all cursor-pointer ${active === v.id ? "border-primary bg-primary/3" : "border-border hover:border-primary/40 bg-card"}`}
            onClick={() => !isPending && activate(v.id)}>

            {/* Thumb */}
            <VariantThumb v={v} active={active === v.id} />

            {/* Info */}
            <div className="mt-3 flex items-start gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-foreground">{v.name}</span>
                  <span style={{ background: v.badgeColor + "18", color: v.badgeColor, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 100 }}>
                    {active === v.id ? "✓ مفعّل" : v.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); setPreviewing(v.id); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Eye size={12} /> معاينة
              </button>
              {active !== v.id && (
                <button
                  onClick={e => { e.stopPropagation(); activate(v.id); }}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                  style={{ background: "#1A56DB" }}
                >
                  {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  تفعيل
                </button>
              )}
              {active === v.id && (
                <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#059669" }}>
                  <Check size={12} /> مفعّل الآن
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Live Preview Modal */}
      {previewing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }} onClick={() => setPreviewing(null)}>
          <div style={{
            width: "90vw", height: "88vh",
            background: "#fff", borderRadius: 20,
            overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 40px 80px rgba(0,0,0,0.4)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>معاينة: {VARIANTS.find(v=>v.id===previewing)?.name}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { activate(previewing); setPreviewing(null); }}
                  style={{ padding: "6px 16px", borderRadius: 8, background: "#1A56DB", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >تفعيل هذا التصميم</button>
                <button onClick={() => setPreviewing(null)} style={{ padding: "6px 14px", borderRadius: 8, background: "#F1F5F9", border: "1px solid #E2E8F0", fontSize: 13, cursor: "pointer" }}>✕ إغلاق</button>
              </div>
            </div>
            <iframe
              src={VARIANTS.find(v=>v.id===previewing)?.preview}
              style={{ flex: 1, border: "none", width: "100%" }}
              title="معاينة التصميم"
            />
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="rounded-xl bg-muted/50 border border-border p-4 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground block mb-1">💡 ملاحظة</strong>
        تغيير التصميم يظهر فوراً لجميع زوار الموقع. يمكنك المعاينة الكاملة بالضغط على "معاينة" قبل التفعيل.
        جميع التصاميم تستخدم نفس البيانات الحقيقية (الباقات، المحتوى، الروابط).
      </div>
    </div>
  );
}
