import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Scale, Users, Sparkles, CheckCircle2, ChevronLeft,
  Loader2, Wand2, FolderOpen, Mail, SkipForward, RefreshCw,
  Star, Briefcase, Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SPECIALTIES = [
  { label: "قانون تجاري",    icon: "🏢" },
  { label: "قانون جنائي",    icon: "⚖️" },
  { label: "قانون مدني",     icon: "📜" },
  { label: "قانون عمالي",    icon: "👷" },
  { label: "قانون أسرة",     icon: "🏠" },
  { label: "قانون عقارات",   icon: "🏗️" },
  { label: "قانون إداري",    icon: "🏛️" },
  { label: "تحكيم دولي",     icon: "🌐" },
  { label: "ملكية فكرية",    icon: "💡" },
  { label: "عقود وتفاوض",    icon: "🤝" },
  { label: "قانون مصرفي",    icon: "🏦" },
  { label: "عام",            icon: "⭐" },
];

const SIZES = [
  { value: "solo",   label: "محامي فردي",    sub: "أنت وحدك",        icon: "👤" },
  { value: "small",  label: "2–5 محامين",    sub: "فريق صغير",       icon: "👥" },
  { value: "medium", label: "6–20 محامياً",  sub: "مكتب متوسط",      icon: "🏢" },
  { value: "large",  label: "+20 محامياً",   sub: "مكتب كبير",       icon: "🏛️" },
];

const CASE_TYPES = ["مدني","تجاري","جنائي","عمالي","أسرة","عقارات","إداري","تحكيم","عام"];

const STEPS = [
  {
    id: "office",
    icon: Building2,
    color: "from-blue-500 to-blue-700",
    title: "مرحباً في عدالة AI 🎉",
    sub: "لنبدأ بتعريف النظام بمكتبك",
    progress: 25,
  },
  {
    id: "case",
    icon: FolderOpen,
    color: "from-emerald-500 to-emerald-700",
    title: "أنشئ أول قضية",
    sub: "ابدأ عملك الحقيقي الآن — يمكنك تعديلها لاحقاً",
    progress: 60,
  },
  {
    id: "team",
    icon: Users,
    color: "from-violet-500 to-violet-700",
    title: "ادعُ فريقك",
    sub: "دعوة محامٍ مساعد أو موظف (اختياري)",
    progress: 85,
  },
  {
    id: "done",
    icon: Sparkles,
    color: "from-amber-500 to-orange-600",
    title: "مكتبك جاهز! 🚀",
    sub: "تم إعداد كل شيء — لنبدأ",
    progress: 100,
  },
];

interface CaseSuggestion { title: string; type: string; clientName: string; description?: string; }

export default function OnboardingPage() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(0);

  const [officeName, setOfficeName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [officeSize, setOfficeSize] = useState("");

  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);

  const [caseTitle, setCaseTitle] = useState("");
  const [caseType, setCaseType] = useState("");
  const [clientName, setClientName] = useState("");
  const [caseSuggestion, setCaseSuggestion] = useState<CaseSuggestion | null>(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [skipCase, setSkipCase] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [skipInvite, setSkipInvite] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [animating, setAnimating] = useState(false);

  const cur = STEPS[step];
  const Icon = cur.icon;

  const afterComplete = () => {
    qc.setQueryData(["onboarding-state"], { completed: true, step: 10, data: {} });
    nav("/dashboard");
  };

  const skipAll = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/onboarding/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, step: 10, data: {} }),
      }).then(r => r.json()),
    onSuccess: afterComplete,
  });

  function goNext() {
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setAnimating(false);
    }, 180);
  }

  function goPrev() {
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setAnimating(false);
    }, 180);
  }

  async function suggestNames() {
    if (!specialty) return;
    setLoadingNames(true);
    try {
      const r = await fetch(`${BASE}/api/onboarding/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialty, type: "office_name" }),
      });
      const data = await r.json();
      if (Array.isArray(data) && data.length) setNameSuggestions(data);
    } catch { }
    setLoadingNames(false);
  }

  async function suggestCase() {
    if (!specialty) return;
    setLoadingCase(true);
    try {
      const r = await fetch(`${BASE}/api/onboarding/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialty, type: "case" }),
      });
      const data: CaseSuggestion = await r.json();
      if (data?.title) {
        setCaseSuggestion(data);
        setCaseTitle(data.title);
        setCaseType(data.type ?? "مدني");
        setClientName(data.clientName ?? "");
      }
    } catch { }
    setLoadingCase(false);
  }

  useEffect(() => {
    if (step === 1 && specialty && !caseSuggestion) {
      suggestCase();
    }
  }, [step]);

  async function finishSetup() {
    setSubmitting(true);
    try {
      await fetch(`${BASE}/api/onboarding/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officeName,
          specialty,
          officeSize,
          firstCase: (!skipCase && caseTitle)
            ? { title: caseTitle, type: caseType, clientName }
            : null,
          inviteEmail: (!skipInvite && inviteEmail) ? inviteEmail : null,
        }),
      });
    } catch { }

    qc.setQueryData(["onboarding-state"], { completed: true, step: 10, data: {} });
    goNext();
    setSubmitting(false);
  }

  function canContinue() {
    if (step === 0) return officeName.trim().length >= 2 && specialty && officeSize;
    if (step === 1) return skipCase || (caseTitle.trim().length >= 2);
    if (step === 2) return true;
    return true;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      dir="rtl"
      style={{
        background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%)",
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
      </div>

      <div className={cn(
        "w-full max-w-lg transition-all duration-300",
        animating ? "opacity-0 scale-95 translate-y-2" : "opacity-100 scale-100 translate-y-0"
      )}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <span className="font-black text-foreground">عدالة AI</span>
          </div>
          <button
            onClick={() => skipAll.mutate()}
            disabled={skipAll.isPending}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
            تخطي الإعداد
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">
              الخطوة {step + 1} من {STEPS.length}
            </span>
            <span className="text-xs font-bold text-primary">{cur.progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${cur.progress}%`,
                background: "linear-gradient(90deg, hsl(var(--primary)), #7c3aed)",
              }}
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className={cn("p-5 bg-gradient-to-l text-white", cur.color)}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black">{cur.title}</h1>
                <p className="text-white/80 text-xs">{cur.sub}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="font-semibold text-sm">اسم مكتبك القانوني *</Label>
                  <div className="relative">
                    <Input
                      value={officeName}
                      onChange={e => setOfficeName(e.target.value)}
                      placeholder="مثال: مكتب الأحمدي للمحاماة"
                      className="text-base h-12 pl-10"
                      autoFocus
                    />
                    {officeName && (
                      <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {nameSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {nameSuggestions.map(s => (
                        <button
                          key={s}
                          onClick={() => setOfficeName(s)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                        >{s}</button>
                      ))}
                    </div>
                  )}
                  {specialty && (
                    <button
                      onClick={suggestNames}
                      disabled={loadingNames}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                    >
                      {loadingNames
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Wand2 className="h-3.5 w-3.5" />}
                      اقترح اسماً بالذكاء الاصطناعي
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-sm">التخصص القانوني *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SPECIALTIES.map(s => (
                      <button
                        key={s.label}
                        onClick={() => setSpecialty(s.label)}
                        className={cn(
                          "px-2 py-2.5 rounded-xl border text-xs transition-all text-center",
                          specialty === s.label
                            ? "bg-primary/15 border-primary/60 text-primary font-semibold scale-105 shadow-sm"
                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}
                      >
                        <span className="text-base block mb-0.5">{s.icon}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-sm">حجم المكتب *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SIZES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => setOfficeSize(s.value)}
                        className={cn(
                          "px-3 py-3 rounded-xl border transition-all text-right",
                          officeSize === s.value
                            ? "bg-primary/15 border-primary/60 shadow-sm"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{s.icon}</span>
                          <div>
                            <p className={cn("text-sm font-semibold", officeSize === s.value ? "text-primary" : "text-foreground")}>{s.label}</p>
                            <p className="text-xs text-muted-foreground">{s.sub}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                {loadingCase && (
                  <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-xl p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    الذكاء الاصطناعي يقترح قضية مناسبة لتخصصك…
                  </div>
                )}

                {caseSuggestion && !loadingCase && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-1">
                      <Wand2 className="h-3.5 w-3.5" />
                      اقتراح الذكاء الاصطناعي
                    </div>
                    <p className="text-emerald-800 text-xs">{caseSuggestion.description}</p>
                  </div>
                )}

                {!skipCase && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">عنوان القضية *</Label>
                      <Input
                        value={caseTitle}
                        onChange={e => setCaseTitle(e.target.value)}
                        placeholder="مثال: نزاع عقاري على ملكية أرض"
                        className="h-10"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">نوع القضية</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {CASE_TYPES.map(t => (
                            <button
                              key={t}
                              onClick={() => setCaseType(t)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs border transition-all",
                                caseType === t
                                  ? "bg-primary/15 border-primary/60 text-primary font-semibold"
                                  : "border-border text-muted-foreground hover:border-primary/30"
                              )}
                            >{t}</button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">اسم الموكّل</Label>
                        <Input
                          value={clientName}
                          onChange={e => setClientName(e.target.value)}
                          placeholder="مثال: أحمد الغامدي"
                          className="h-10"
                        />
                      </div>
                    </div>
                    <button
                      onClick={suggestCase}
                      disabled={loadingCase}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loadingCase && "animate-spin")} />
                      اقتراح قضية مختلفة
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setSkipCase(!skipCase)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 border border-dashed border-border rounded-xl"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  {skipCase ? "✓ سأتخطى إنشاء القضية الآن" : "تخطي هذه الخطوة"}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm">
                  <p className="text-violet-800 font-semibold mb-1">🤝 ادعُ فريقك ليبدأ معك</p>
                  <p className="text-violet-700 text-xs">
                    سيتلقى المحامون والموظفون دعوة عبر البريد الإلكتروني للانضمام لمكتبك
                  </p>
                </div>

                {!skipInvite && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Input
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@lawfirm.com"
                        type="email"
                        className="h-11 pl-10"
                        dir="ltr"
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSkipInvite(!skipInvite)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 border border-dashed border-border rounded-xl"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  {skipInvite ? "✓ سأدعو الفريق لاحقاً" : "تخطي — سأدعو لاحقاً"}
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 text-center">
                  <div className="text-4xl mb-2">🎊</div>
                  <h3 className="font-black text-lg text-amber-900 mb-1">مكتبك جاهز تماماً!</h3>
                  <p className="text-amber-700 text-sm">
                    تم إعداد جميع الأنظمة. تجربتك المجانية لمدة 7 أيام فعّالة الآن.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { icon: "⚖️", label: "القضايا", sub: "إدارة كاملة" },
                    { icon: "💰", label: "الفوترة",  sub: "مدفوعات ذكية" },
                    { icon: "🤖", label: "الذكاء AI", sub: "مساعد 24/7" },
                  ].map(f => (
                    <div key={f.label} className="bg-muted/40 rounded-xl p-3 text-center">
                      <div className="text-2xl mb-1">{f.icon}</div>
                      <p className="text-xs font-semibold text-foreground">{f.label}</p>
                      <p className="text-[10px] text-muted-foreground">{f.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
                  <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>
                    <strong>7 أيام مجاناً</strong> — جميع الميزات مفتوحة. لا بطاقة ائتمانية الآن.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 pb-5">
            {step > 0 && step < 3 ? (
              <Button variant="ghost" size="sm" onClick={goPrev} className="text-muted-foreground">
                <ChevronLeft className="h-4 w-4 ml-1" />
                السابق
              </Button>
            ) : <div />}

            {step < 2 && (
              <Button
                onClick={goNext}
                disabled={!canContinue()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6"
              >
                التالي
                <span className="mr-1">←</span>
              </Button>
            )}

            {step === 2 && (
              <Button
                onClick={finishSetup}
                disabled={submitting}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6"
              >
                {submitting
                  ? <><Loader2 className="h-4 w-4 ml-1 animate-spin" />جاري الإعداد…</>
                  : <>إنهاء الإعداد ✓</>}
              </Button>
            )}

            {step === 3 && (
              <Button
                onClick={afterComplete}
                className="bg-gradient-to-l from-amber-500 to-orange-500 hover:opacity-90 text-white font-black px-8"
              >
                🚀 انطلق للداشبورد
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          بياناتك محمية بتشفير كامل · فصل تام بين المكاتب
        </p>
      </div>
    </div>
  );
}
