import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Scale, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, KeyRound, UserPlus, LogIn, Building2 } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL ?? "/";

type Tab = "login" | "register" | "otp";

export default function PortalLogin() {
  const [, nav] = useLocation();
  const search = useSearch();
  const officeSlug = new URLSearchParams(search).get("office") ?? "";

  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: officeData } = useQuery<any>({
    queryKey: ["office-public-mini", officeSlug],
    queryFn: () => fetch(`/api/office/public/${officeSlug}`).then(r => r.ok ? r.json() : null),
    enabled: !!officeSlug,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const office = officeData?.office;
  const primaryColor = office?.primaryColor ?? "#C9A84C";
  const officeName = office?.name ?? office?.tradeName ?? "";
  const logoUrl = office?.logo
    ? (office.logo.startsWith("http") ? office.logo : `/api/storage/objects${office.logo.startsWith("/") ? office.logo : "/" + office.logo}`)
    : null;

  const saveClientInfo = (client: any) => {
    sessionStorage.setItem("client_info", JSON.stringify(client));
  };

  const handleLogin = async () => {
    if (!email || !password) { toast.error("أدخل البريد وكلمة المرور"); return; }
    setLoading(true);
    const r = await fetch(`${BASE}api/client-auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.error) { toast.error(d.error); return; }
    saveClientInfo(d.client);
    toast.success("أهلاً " + (d.client.name ?? d.client.email) + " 👋");
    nav("/portal/my-cases");
  };

  const handleRegister = async () => {
    if (!email || !password) { toast.error("أدخل البريد وكلمة المرور"); return; }
    if (password.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    setLoading(true);
    const r = await fetch(`${BASE}api/client-auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.error) { toast.error(d.error); return; }
    saveClientInfo(d.client);
    toast.success("تم إنشاء حسابك بنجاح 🎉");
    nav("/portal/my-cases");
  };

  const handleRequestOtp = async () => {
    if (!email) { toast.error("أدخل بريدك الإلكتروني"); return; }
    setLoading(true);
    const r = await fetch(`${BASE}api/client-auth/request-otp`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.error) { toast.error(d.error); return; }
    setOtpSent(true);
    toast.success("تم إرسال رمز إلى بريدك");
  };

  const handleVerifyOtp = async () => {
    if (!otp) { toast.error("أدخل الرمز"); return; }
    setLoading(true);
    const r = await fetch(`${BASE}api/client-auth/verify-otp`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.error) { toast.error(d.error); return; }
    saveClientInfo(d.client);
    toast.success("تم التحقق ✅");
    nav("/portal/my-cases");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1b2a] flex flex-col items-center justify-center px-4"
      style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* Office branding banner — shown when coming from /firms/:slug */}
      {officeSlug && (
        <div className="mb-5 flex flex-col items-center gap-2 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          {logoUrl ? (
            <img src={logoUrl} alt={officeName} className="h-14 w-14 rounded-2xl object-cover ring-2 shadow-lg"
              style={{ ringColor: `${primaryColor}40` }} />
          ) : (
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg"
              style={{ background: `${primaryColor}20`, border: `2px solid ${primaryColor}40`, color: primaryColor }}>
              {officeName ? officeName[0] : <Building2 className="h-6 w-6" />}
            </div>
          )}
          {officeName && (
            <div className="text-center">
              <div className="text-base font-black text-white">{officeName}</div>
              <div className="text-xs text-slate-400">بوابة العملاء</div>
            </div>
          )}
          {!officeName && (
            <div className="text-xs text-slate-400">بوابة عملاء المكتب</div>
          )}
        </div>
      )}

      {/* Logo — shown when no office context */}
      {!officeSlug && (
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center">
            <Scale className="h-8 w-8 text-[#C9A84C]" />
          </div>
          <h1 className="text-2xl font-black text-[#C9A84C]">عدالة AI</h1>
          <p className="text-slate-400 text-sm">بوابة العملاء الذكية</p>
        </div>
      )}

      {/* Card */}
      <div className="w-full max-w-sm bg-[#0a1520] border border-white/10 rounded-2xl p-6 shadow-2xl"
        style={{ borderColor: officeSlug ? `${primaryColor}25` : undefined }}>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#0d1b2a] rounded-xl p-1 mb-5">
          {([
            { id: "login",    label: "دخول",     icon: LogIn },
            { id: "register", label: "تسجيل",    icon: UserPlus },
            { id: "otp",      label: "رمز سريع", icon: KeyRound },
          ] as { id: Tab; label: string; icon: any }[]).map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setOtpSent(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
                style={active
                  ? { background: primaryColor, color: "#0d1b2a" }
                  : { color: "#94a3b8" }
                }>
                <Icon className="h-3 w-3" />{t.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3.5">
          {/* Email — shared */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl py-2.5 pr-9 pl-3 text-sm text-white focus:outline-none placeholder:text-slate-600"
                style={{ borderColor: email ? `${primaryColor}40` : undefined }}
              />
            </div>
          </div>

          {/* Name — register only */}
          {tab === "register" && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400">الاسم الكامل</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="محمد الأحمدي"
                className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none placeholder:text-slate-600"
              />
            </div>
          )}

          {/* Password — login + register */}
          {(tab === "login" || tab === "register") && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={tab === "register" ? "6 أحرف على الأقل" : "••••••••"}
                  className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl py-2.5 pr-9 pl-9 text-sm text-white focus:outline-none placeholder:text-slate-600"
                  onKeyDown={e => e.key === "Enter" && (tab === "login" ? handleLogin() : handleRegister())}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* OTP flow */}
          {tab === "otp" && !otpSent && (
            <button onClick={handleRequestOtp} disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              style={{ background: primaryColor, color: "#0d1b2a" }}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              إرسال رمز إلى بريدي
            </button>
          )}

          {tab === "otp" && otpSent && (
            <>
              <div className="text-center text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-2 px-3">
                تم الإرسال — تحقق من بريدك
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">الرمز المكوّن من 6 أرقام</label>
                <input
                  type="text" inputMode="numeric" maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="_ _ _ _ _ _"
                  className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl py-2.5 px-3 text-sm text-center text-white tracking-[0.3em] focus:outline-none placeholder:text-slate-600"
                  onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                />
              </div>
              <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                style={{ background: primaryColor, color: "#0d1b2a" }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                تأكيد الرمز والدخول
              </button>
              <button onClick={() => { setOtpSent(false); setOtp(""); }}
                className="w-full text-xs text-slate-500 hover:text-white text-center">
                إرسال رمز جديد
              </button>
            </>
          )}

          {/* Main action button */}
          {tab !== "otp" && (
            <button
              onClick={tab === "login" ? handleLogin : handleRegister}
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 hover:opacity-90"
              style={{ background: primaryColor, color: "#0d1b2a" }}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : tab === "login"
                  ? <LogIn className="h-4 w-4" />
                  : <UserPlus className="h-4 w-4" />}
              {tab === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
            </button>
          )}
        </div>
      </div>

      {/* Back link — goes to firm's page if office context exists */}
      <button
        onClick={() => officeSlug ? (window.location.href = `/firms/${officeSlug}`) : window.history.back()}
        className="mt-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {officeSlug && officeName ? `الرجوع إلى ${officeName}` : "رجوع"}
      </button>
    </div>
  );
}
