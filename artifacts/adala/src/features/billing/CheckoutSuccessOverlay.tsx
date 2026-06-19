import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  sessionId: string;
  onDone: () => void;
}

export function CheckoutSuccessOverlay({ sessionId, onDone }: Props) {
  const [stage, setStage] = useState<"verifying" | "success" | "error">("verifying");
  const [planName, setPlanName]   = useState("");
  const [errorMsg, setErrorMsg]   = useState("");
  const [dots, setDots]           = useState(".");

  /* Animated dots while verifying */
  useEffect(() => {
    if (stage !== "verifying") return;
    const id = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(id);
  }, [stage]);

  /* Call verify-payment once */
  useEffect(() => {
    let cancelled = false;
    async function verify() {
      try {
        const r = await fetch(`${BASE}/api/billing/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await r.json();
        if (cancelled) return;
        if (data.ok) {
          setPlanName(data.planName ?? "");
          setStage("success");
        } else {
          setErrorMsg(data.error ?? "فشل التحقق من الدفع");
          setStage("error");
        }
      } catch {
        if (!cancelled) { setErrorMsg("خطأ في الاتصال بالخادم"); setStage("error"); }
      }
    }
    verify();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>

      <div className="relative w-full max-w-md rounded-3xl overflow-hidden border border-white/10 text-center"
        style={{ background: "linear-gradient(135deg,#0F1729 0%,#111827 100%)" }}>

        {/* Top glow */}
        <div className={cn(
          "absolute inset-x-0 top-0 h-48 bg-gradient-to-b opacity-30 pointer-events-none",
          stage === "success" ? "from-emerald-500/40" : stage === "error" ? "from-red-500/30" : "from-primary/30"
        )} />

        <div className="relative px-8 py-12 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            {stage === "verifying" && (
              <div className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center"
                style={{ background: "rgba(37,99,235,0.1)" }}>
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
            )}
            {stage === "success" && (
              <div className="w-24 h-24 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-500"
                style={{ background: "rgba(16,185,129,0.15)", border: "4px solid rgba(16,185,129,0.4)" }}>
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
            )}
            {stage === "error" && (
              <div className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.1)", border: "4px solid rgba(239,68,68,0.3)" }}>
                <span className="text-4xl">⚠️</span>
              </div>
            )}
          </div>

          {/* Text */}
          {stage === "verifying" && (
            <>
              <h2 className="text-2xl font-black">جاري التحقق من الدفع{dots}</h2>
              <p className="text-muted-foreground text-sm">نتحقق من نجاح العملية ونفعّل باقتك فوراً</p>
            </>
          )}

          {stage === "success" && (
            <>
              <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                <h2 className="text-3xl font-black text-emerald-400">تم الدفع بنجاح! 🎉</h2>
                <p className="text-muted-foreground">
                  تم تفعيل باقة <span className="font-bold text-foreground">{planName}</span> على حسابك فوراً
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {["⚡ مفعّلة الآن", "🔒 بيانات محمية", "🤖 AI جاهز"].map(b => (
                  <div key={b} className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">{b}</div>
                ))}
              </div>
              <Button onClick={onDone}
                className="w-full h-12 font-bold text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl">
                <Sparkles className="h-4 w-4" />
                ابدأ الاستخدام الآن
              </Button>
            </>
          )}

          {stage === "error" && (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-red-400">تعذّر التحقق</h2>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
                <p className="text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-2">
                  إذا تمت عملية الدفع من حسابك البنكي، سيتم تفعيل الباقة تلقائياً خلال دقائق. يمكنك التواصل مع الدعم إذا استمرت المشكلة.
                </p>
              </div>
              <Button onClick={onDone} variant="outline"
                className="w-full gap-2 border-white/10 bg-white/5">
                <ArrowLeft className="h-4 w-4" /> العودة للوحة الفوترة
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
