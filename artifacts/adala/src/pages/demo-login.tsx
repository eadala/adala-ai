import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Scale, Building2, Users, Briefcase, ArrowLeft,
  ChevronLeft, Gavel, Star, CheckCircle2, Loader2,
  Eye, Crown, FileText, TrendingUp, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const OFFICES = [
  {
    id: "north",
    name: "مكتب الشمال القانوني",
    slug: "مكتب-الشمال",
    specialty: "قانون تجاري ومدني",
    city: "الرياض",
    size: "12 محامياً",
    rating: 4.9,
    cases: 47,
    color: "from-blue-600 to-blue-800",
    accent: "border-blue-400/40",
    icon: "⚖️",
    users: [
      { name: "أ. خالد الشمري", role: "محامٍ أول", avatar: "خ", color: "bg-blue-600" },
      { name: "أ. سلطان القحطاني", role: "مدير المكتب", avatar: "س", color: "bg-indigo-600" },
    ],
  },
  {
    id: "south",
    name: "مكتب الجنوب للمحاماة",
    slug: "مكتب-الجنوب",
    specialty: "قانون أسرة وعمالي",
    city: "جدة",
    size: "8 محامين",
    rating: 4.7,
    cases: 31,
    color: "from-emerald-600 to-teal-700",
    accent: "border-emerald-400/40",
    icon: "🏛️",
    users: [
      { name: "أ. منى الغامدي", role: "محامية أولى", avatar: "م", color: "bg-emerald-600" },
      { name: "أ. ريم الزهراني", role: "محامية", avatar: "ر", color: "bg-teal-600" },
    ],
  },
];

export default function DemoLoginPage() {
  const [, nav] = useLocation();
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const office = OFFICES.find(o => o.id === selectedOffice);

  function handleLogin() {
    if (!selectedOffice) return;
    setLoading(true);
    setTimeout(() => {
      nav(`${BASE}/demo`);
    }, 1200);
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0F1B35 0%, #1A2744 60%, #0D1829 100%)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #2563EB, transparent)" }} />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #7C3AED, transparent)" }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link href={`${BASE}/sign-in`}>
          <button className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-8">
            <ChevronLeft className="h-4 w-4" />
            العودة لتسجيل الدخول
          </button>
        </Link>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Gavel className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black text-white">عدالة AI</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">دخول تجريبي سريع</h1>
          <p className="text-slate-400 text-sm">
            اختر مكتباً وادخل فوراً — لا حاجة لتسجيل أو بطاقة ائتمانية
          </p>
        </div>

        {!loading ? (
          <div className="space-y-4">
            {!selectedOffice ? (
              <>
                <p className="text-xs text-slate-500 text-center mb-4">اختر المكتب الذي تريد تجربته</p>
                {OFFICES.map(o => (
                  <button
                    key={o.id}
                    onClick={() => { setSelectedOffice(o.id); setSelectedUser(null); }}
                    className={cn(
                      "w-full text-right p-4 rounded-2xl border-2 transition-all duration-200 hover:scale-[1.01]",
                      "bg-white/5 backdrop-blur-sm hover:bg-white/10",
                      "border-white/10 hover:border-white/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 text-xl", o.color)}>
                        {o.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-sm">{o.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">{o.city}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{o.specialty}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-400" />
                            {o.rating}
                          </span>
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {o.cases} قضية
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {o.size}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft className="h-4 w-4 text-slate-600 shrink-0 mt-1 rotate-180" />
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <>
                <button
                  onClick={() => { setSelectedOffice(null); setSelectedUser(null); }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  تغيير المكتب
                </button>

                <div className={cn("p-3 rounded-xl border bg-white/5 mb-4", office?.accent)}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-sm", office?.color)}>
                      {office?.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{office?.name}</p>
                      <p className="text-xs text-slate-400">{office?.specialty}</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-400 mr-auto" />
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-3">اختر الشخصية التي تريد الدخول بها</p>
                {office?.users.map((u, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedUser(i)}
                    className={cn(
                      "w-full text-right p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3",
                      selectedUser === i
                        ? "border-blue-500/60 bg-blue-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0", u.color)}>
                      {u.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.role}</p>
                    </div>
                    {selectedUser === i && <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />}
                  </button>
                ))}

                <button
                  onClick={handleLogin}
                  disabled={selectedUser === null}
                  className={cn(
                    "w-full mt-4 py-3.5 rounded-xl font-black text-sm transition-all duration-200",
                    selectedUser !== null
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:scale-[1.01]"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                  )}
                >
                  <Eye className="h-4 w-4 inline ml-2" />
                  ادخل الآن واستكشف المنصة
                </button>
              </>
            )}

            <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/5 space-y-2">
              {[
                "بيانات تجريبية معزولة تماماً — لا تأثير على حسابات حقيقية",
                "جميع الميزات متاحة: القضايا، الفوترة، AI، الموظفون",
                "لا تسجيل ولا بطاقة ائتمانية مطلوبة",
              ].map(t => (
                <div key={t} className="flex items-start gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  {t}
                </div>
              ))}
            </div>

            <div className="text-center mt-4">
              <span className="text-xs text-slate-600">تريد حساباً حقيقياً؟ </span>
              <Link href={`${BASE}/sign-up`}>
                <span className="text-xs text-blue-400 hover:text-blue-300 font-bold cursor-pointer">
                  سجّل مجاناً ←
                </span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            </div>
            <p className="text-white font-bold mb-1">جارٍ تحميل بيئة المكتب…</p>
            <p className="text-slate-500 text-sm">
              {office?.name}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-slate-600">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              بيانات تجريبية واقعية جاهزة
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
