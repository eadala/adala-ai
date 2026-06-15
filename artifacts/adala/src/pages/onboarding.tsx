import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, Building2, Users, Sparkles, CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SPECIALTIES = [
  "قانون تجاري", "قانون جنائي", "قانون مدني", "قانون عمالي",
  "قانون أسرة", "قانون عقارات", "قانون إداري", "تحكيم دولي", "عام",
];
const SIZES = [
  { value: "solo",   label: "محامي فردي" },
  { value: "small",  label: "2-5 محامين" },
  { value: "medium", label: "6-20 محامياً" },
  { value: "large",  label: "+20 محامياً" },
];

const STEPS = [
  { icon: Building2, title: "مرحباً بك في عدالة AI", sub: "دعنا نعرّف المنصة بمكتبك" },
  { icon: Scale,     title: "تخصص المكتب",            sub: "ما هي أبرز مجالات عملك القانوني؟" },
  { icon: Users,     title: "حجم المكتب",              sub: "كم عدد المحامين لديك؟" },
  { icon: Sparkles,  title: "أنت جاهز!",               sub: "تم إعداد حسابك بنجاح" },
];

export default function OnboardingPage() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [officeName, setOfficeName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [size, setSize] = useState("");

  const afterComplete = () => {
    qc.setQueryData(["onboarding-state"], { completed: true, step: 4, data: {} });
    nav("/dashboard");
  };

  const completeMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/onboarding/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, step: 4, data: { officeName, specialty, size } }),
      }).then(r => r.json()),
    onSuccess: afterComplete,
  });

  const skipMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/onboarding/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, step: 4, data: {} }),
      }).then(r => r.json()),
    onSuccess: afterComplete,
  });

  const cur = STEPS[step];
  const Icon = cur.icon;
  const isLast = step === STEPS.length - 1;

  function next() {
    if (isLast) { completeMut.mutate(); return; }
    setStep(s => s + 1);
  }
  function canNext() {
    if (step === 0) return officeName.trim().length > 0;
    if (step === 1) return specialty.length > 0;
    if (step === 2) return size.length > 0;
    return true;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">{cur.title}</h1>
            <p className="text-muted-foreground text-sm">{cur.sub}</p>
          </div>

          {/* Step Content */}
          {step === 0 && (
            <div className="space-y-3">
              <Label>اسم المكتب</Label>
              <Input
                value={officeName}
                onChange={e => setOfficeName(e.target.value)}
                placeholder="مثال: مكتب الأحمدي للمحاماة"
                className="text-center text-lg h-12"
                autoFocus
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-3 gap-2">
              {SPECIALTIES.map(s => (
                <button
                  key={s}
                  onClick={() => setSpecialty(s)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm border transition-all",
                    specialty === s
                      ? "bg-primary/20 border-primary/50 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >{s}</button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {SIZES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSize(s.value)}
                  className={cn(
                    "px-4 py-4 rounded-xl border transition-all text-center",
                    size === s.value
                      ? "bg-primary/20 border-primary/50 text-primary font-semibold"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <Users className="h-5 w-5 mx-auto mb-1" />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                {[
                  { label: "اسم المكتب", val: officeName },
                  { label: "التخصص",     val: specialty },
                  { label: "الحجم",      val: SIZES.find(s => s.value === size)?.label },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-foreground font-medium">{item.val || "-"}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-green-400 justify-center">
                <CheckCircle2 className="h-4 w-4" />
                جاهز للانطلاق!
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => skipMut.mutate()}
              disabled={skipMut.isPending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              تخطي الإعداد
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={next}
                disabled={!canNext() || completeMut.isPending}
                className="bg-primary hover:bg-[#b8943f] text-black font-bold px-6"
              >
                {completeMut.isPending && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
                {isLast ? "ابدأ الآن" : "التالي"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
