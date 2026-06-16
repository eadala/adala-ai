/**
 * /firms/:slug/login — Branded per-office login portal
 * Two modes: Employee (Clerk) + Client (portal auth embedded)
 */
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Scale, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft,
  KeyRound, UserPlus, LogIn, Users, Briefcase, Building2,
  CheckCircle2, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type AuthMode = "choose" | "employee" | "client";
type ClientTab = "login" | "register" | "otp";

function imgSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `/api/storage/objects${path.startsWith("/") ? path : "/" + path}`;
}

/* ══════════════════════════════════════════════════
   CLIENT AUTH FORM (embedded)
══════════════════════════════════════════════════ */
function ClientAuthForm({ primaryColor }: { primaryColor: string }) {
  const [, nav] = useLocation();
  const [tab, setTab] = useState<ClientTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const saveClientInfo = (client: any) => sessionStorage.setItem("client_info", JSON.stringify(client));

  const handleLogin = async () => {
    if (!email || !password) { toast.error("أدخل البريد وكلمة المرور"); return; }
    setLoading(true);
    const r = await fetch(`${BASE}/api/client-auth/login`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json(); setLoading(false);
    if (d.error) { toast.error(d.error); return; }
    saveClientInfo(d.client);
    toast.success("أهلاً " + (d.client.name ?? d.client.email) + " 👋");
    nav("/portal/my-cases");
  };

  const handleRegister = async () => {
    if (!email || !password) { toast.error("أدخل البريد وكلمة المرور"); return; }
    if (password.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    setLoading(true);
    const r = await fetch(`${BASE}/api/client-auth/register`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const d = await r.json(); setLoading(false);
    if (d.error) { toast.error(d.error); return; }
    saveClientInfo(d.client);
    toast.success("تم إنشاء حسابك بنجاح 🎉");
    nav("/portal/my-cases");
  };

  const handleRequestOtp = async () => {
    if (!email) { toast.error("أدخل بريدك الإلكتروني"); return; }
    setLoading(true);
    const r = await fetch(`${BASE}/api/client-auth/request-otp`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await r.json(); setLoading(false);
    if (d.error) { toast.error(d.error); return; }
    setOtpSent(true); toast.success("تم إرسال رمز إلى بريدك");
  };

  const handleVerifyOtp = async () => {
    if (!otp) { toast.error("أدخل الرمز"); return; }
    setLoading(true);
    const r = await fetch(`${BASE}/api/client-auth/verify-otp`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const d = await r.json(); setLoading(false);
    if (d.error) { toast.error(d.error); return; }
    saveClientInfo(d.client);
    toast.success("تم التحقق ✅");
    nav("/portal/my-cases");
  };

  const inputCls = "w-full bg-white/5 border border-white/15 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none placeholder:text-white/30 focus:border-white/30 transition-colors";

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {([
          { id: "login",    label: "دخول",     icon: LogIn   },
          { id: "register", label: "تسجيل",    icon: UserPlus },
          { id: "otp",      label: "رمز سريع", icon: KeyRound },
        ] as { id: ClientTab; label: string; icon: any }[]).map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setOtpSent(false); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
              style={active ? { background: primaryColor, color: "#fff" } : { color: "rgba(255,255,255,0.5)" }}>
              <Icon className="h-3 w-3" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label className="text-xs text-white/50">البريد الإلكتروني</label>
        <div className="relative">
          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com" className={`${inputCls} pr-9`} />
        </div>
      </div>

      {/* Name (register) */}
      {tab === "register" && (
        <div className="space-y-1">
          <label className="text-xs text-white/50">الاسم الكامل</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="محمد الأحمدي" className={inputCls} />
        </div>
      )}

      {/* Password */}
      {(tab === "login" || tab === "register") && (
        <div className="space-y-1">
          <label className="text-xs text-white/50">كلمة المرور</label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input type={showPw ? "text" : "password"} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={tab === "register" ? "6 أحرف على الأقل" : "••••••••"}
              className={`${inputCls} pr-9 pl-9`}
              onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())} />
            <button type="button" onClick={() => setShowPw(p => !p)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* OTP flow */}
      {tab === "otp" && !otpSent && (
        <button onClick={handleRequestOtp} disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 hover:opacity-90 text-white"
          style={{ background: primaryColor }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          إرسال رمز إلى بريدي
        </button>
      )}
      {tab === "otp" && otpSent && (
        <>
          <div className="text-center text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-2 px-3">
            تم الإرسال — تحقق من بريدك الإلكتروني
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50">الرمز المكوّن من 6 أرقام</label>
            <input type="text" inputMode="numeric" maxLength={6} value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="_ _ _ _ _ _"
              className={`${inputCls} text-center tracking-[0.3em]`}
              onKeyDown={e => e.key === "Enter" && handleVerifyOtp()} />
          </div>
          <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 hover:opacity-90 text-white"
            style={{ background: primaryColor }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            تأكيد الرمز والدخول
          </button>
          <button onClick={() => { setOtpSent(false); setOtp(""); }}
            className="w-full text-xs text-white/40 hover:text-white/60 text-center">
            إرسال رمز جديد
          </button>
        </>
      )}

      {/* Main action */}
      {tab !== "otp" && (
        <button onClick={tab === "login" ? handleLogin : handleRegister} disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 hover:opacity-90 text-white"
          style={{ background: primaryColor }}>
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : tab === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {tab === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════ */
export default function OfficeLogin() {
  const { slug } = useParams<{ slug: string }>();
  const [mode, setMode] = useState<AuthMode>("choose");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["office-public", slug],
    queryFn: () => fetch(`/api/office/public/${slug}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const office = data?.office;
  const primaryColor = office?.primaryColor ?? "#1A56DB";
  const officeName = office?.name ?? office?.tradeName ?? "المكتب";
  const logoSrc = imgSrc(office?.logo);
  const coverSrc = imgSrc(office?.coverImage);

  /* Gradient derived from primaryColor */
  const bg = `linear-gradient(135deg, #0d1b2a 0%, ${primaryColor}22 100%)`;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d1b2a" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col" style={{ background: bg, fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      {/* Cover strip */}
      {coverSrc && (
        <div className="h-32 w-full relative overflow-hidden">
          <img src={coverSrc} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-[#0d1b2a]" />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Office identity */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {logoSrc ? (
            <img src={logoSrc} alt={officeName}
              className="h-20 w-20 rounded-2xl object-cover ring-4 shadow-2xl"
              style={{ ringColor: `${primaryColor}60` }} />
          ) : (
            <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-3xl font-black shadow-2xl"
              style={{ background: `${primaryColor}25`, border: `2px solid ${primaryColor}50`, color: primaryColor }}>
              {officeName[0] ?? <Building2 className="h-8 w-8" />}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black text-white">{officeName}</h1>
            <p className="text-sm text-white/50 mt-0.5">بوابة تسجيل الدخول</p>
          </div>
        </div>

        {/* ── Mode: Choose ── */}
        {mode === "choose" && (
          <div className="w-full max-w-sm space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {/* Employee card */}
            <button
              onClick={() => { window.location.href = `${BASE}/sign-in?redirect_url=${encodeURIComponent(window.location.origin + BASE + "/dashboard")}`; }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border text-right transition-all hover:scale-[1.01] active:scale-[0.99] group"
              style={{ background: `${primaryColor}15`, borderColor: `${primaryColor}35` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: primaryColor }}>
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-white text-base">دخول الموظفين</div>
                <div className="text-xs text-white/50 mt-0.5">للمحامين والإداريين وفريق المكتب</div>
              </div>
              <ChevronLeft className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
            </button>

            {/* Client card */}
            <button
              onClick={() => setMode("client")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/15 bg-white/5 text-right transition-all hover:scale-[1.01] active:scale-[0.99] group hover:bg-white/8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/20 border border-emerald-500/30">
                <Users className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-white text-base">بوابة العملاء</div>
                <div className="text-xs text-white/50 mt-0.5">متابعة قضاياك، فواتيرك، ومستنداتك</div>
              </div>
              <ChevronLeft className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-white/30">أو</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Back to site */}
            <a href={`/firms/${slug}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition-colors border border-white/10 hover:border-white/20">
              <Scale className="h-3.5 w-3.5" />
              العودة إلى موقع المكتب
            </a>
          </div>
        )}

        {/* ── Mode: Client login ── */}
        {mode === "client" && (
          <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-right-2 duration-300">
            {/* Back button */}
            <button onClick={() => setMode("choose")}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 mb-4 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              العودة لاختيار نوع الدخول
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <Users className="h-4.5 w-4.5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">بوابة العملاء</div>
                <div className="text-[11px] text-white/40">تسجيل الدخول أو إنشاء حساب جديد</div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <ClientAuthForm primaryColor={primaryColor} />
            </div>
          </div>
        )}

        {/* ── Mode: Employee — handled by redirect, this is just a loading state ── */}
        {mode === "employee" && (
          <div className="flex items-center gap-3 text-white/60">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">جاري الانتقال...</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-white/20">
        مدعوم بـ <span className="text-white/40 font-bold">عدالة AI</span>
      </div>
    </div>
  );
}
