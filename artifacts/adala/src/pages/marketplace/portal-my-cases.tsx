import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scale, LogOut, User, FileText, Clock, CheckCircle2, AlertCircle,
  ExternalLink, Loader2, ArrowLeft, Link2, Plus, ChevronLeft,
  Mail, Phone, KeyRound, Shield, Settings, Lock,
} from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL ?? "/";

const STATUS_AR: Record<string, { label: string; color: string; dot: string }> = {
  open:        { label: "مفتوحة",      color: "text-blue-400",   dot: "bg-blue-400" },
  in_progress: { label: "قيد التنفيذ", color: "text-amber-400",  dot: "bg-amber-400" },
  closed:      { label: "مغلقة",       color: "text-emerald-400", dot: "bg-emerald-400" },
  pending:     { label: "معلّقة",      color: "text-orange-400",  dot: "bg-orange-400" },
};

const TYPE_AR: Record<string, string> = {
  criminal: "جنائية", civil: "مدنية", commercial: "تجارية",
  labor: "عمالية", real_estate: "عقارية", family: "أسرية",
};

export default function PortalMyCases() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const [linkInput, setLinkInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPw, setEditPw] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const { data: me, isLoading, isError } = useQuery({
    queryKey: ["client-me"],
    queryFn: () => fetch(`${BASE}/api/client-auth/me`, {
      credentials: "include",
    }).then(r => {
      if (r.status === 401) throw new Error("unauthenticated");
      if (!r.ok) throw new Error("خطأ في الخادم");
      return r.json();
    }),
    retry: false,
  });

  useEffect(() => {
    if (isError) nav("/portal/login");
  }, [isError]);

  const logout = async () => {
    await fetch(`${BASE}/api/client-auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    sessionStorage.removeItem("client_info");
    toast.success("تم تسجيل الخروج");
    nav("/portal/login");
  };

  const linkToken = async () => {
    const portalToken = linkInput.trim().split("/portal/").pop()?.trim() ?? linkInput.trim();
    if (!portalToken) { toast.error("أدخل الرابط أو الرمز"); return; }
    setLinking(true);
    const r = await fetch(`${BASE}/api/client-auth/link-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalToken }),
    });
    const d = await r.json();
    setLinking(false);
    if (d.error) { toast.error(d.error); return; }
    toast.success("تم ربط القضية بحسابك ✅");
    setLinkInput("");
    qc.invalidateQueries({ queryKey: ["client-me"] });
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    const body: any = {};
    if (editName) body.name = editName;
    if (editPhone) body.phone = editPhone;
    if (editPw) body.password = editPw;
    const r = await fetch(`${BASE}/api/client-auth/me`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setSavingProfile(false);
    if (d.error) { toast.error(d.error); return; }
    toast.success("تم حفظ بياناتك");
    setEditName(""); setEditPhone(""); setEditPw("");
    setShowProfile(false);
    qc.invalidateQueries({ queryKey: ["client-me"] });
  };

  const cases: any[] = me?.linkedCases ?? [];
  const displayName = me?.name ?? me?.email ?? "العميل";

  if (isLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#0d1b2a] flex items-center justify-center" style={{ fontFamily: "'Cairo', sans-serif" }}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#C9A84C]" />
          <span className="text-muted-foreground">جاري التحقق من هويتك...</span>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1b2a] text-foreground" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* Header */}
      <div className="bg-[#0a1520] border-b border-[#C9A84C]/20 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#C9A84C]" />
            <span className="font-black text-[#C9A84C]">عدالة AI</span>
            <span className="text-xs text-muted-foreground mr-1">| قضاياي</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowProfile(p => !p)}
              className="flex items-center gap-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-xl px-3 py-1.5 text-xs text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors">
              <User className="h-3.5 w-3.5" />{displayName}
            </button>
            <button onClick={logout}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors px-2 py-1.5">
              <LogOut className="h-3.5 w-3.5" />خروج
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Profile edit panel */}
        {showProfile && (
          <div className="bg-[#0a1520] border border-[#C9A84C]/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#C9A84C] flex items-center gap-2"><Settings className="h-4 w-4" />بياناتي</h2>
              <button onClick={() => setShowProfile(false)} className="text-xs text-muted-foreground hover:text-white">إغلاق</button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">الاسم الكامل</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder={me?.name ?? "أدخل اسمك"}
                  className="w-full bg-[#0d1b2a] border border-[#C9A84C]/20 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]/60" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">رقم الجوال</label>
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                  placeholder={me?.phone ?? "05xxxxxxxx"}
                  className="w-full bg-[#0d1b2a] border border-[#C9A84C]/20 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]/60" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" />تغيير كلمة المرور (اختياري)
                </label>
                <input type="password" value={editPw} onChange={e => setEditPw(e.target.value)}
                  placeholder="اتركه فارغاً إذا لم تريد التغيير"
                  className="w-full bg-[#0d1b2a] border border-[#C9A84C]/20 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#C9A84C]/60" />
              </div>
            </div>
            <button onClick={saveProfile} disabled={savingProfile}
              className="w-full py-2.5 bg-[#C9A84C] text-[#0d1b2a] font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-[#b8933e] disabled:opacity-60">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              حفظ التغييرات
            </button>
          </div>
        )}

        {/* Welcome */}
        <div className="bg-gradient-to-l from-[#C9A84C]/5 to-[#C9A84C]/15 border border-[#C9A84C]/30 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
              <User className="h-6 w-6 text-[#C9A84C]" />
            </div>
            <div>
              <p className="font-bold text-[#C9A84C] text-lg">مرحباً، {displayName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />{me?.email}
              </p>
            </div>
            <div className="mr-auto text-left">
              <p className="text-2xl font-black text-[#C9A84C]">{cases.length}</p>
              <p className="text-xs text-muted-foreground">قضايا مرتبطة</p>
            </div>
          </div>
        </div>

        {/* Cases list */}
        {cases.length === 0 ? (
          <div className="bg-[#0a1520] border border-[#C9A84C]/10 rounded-2xl p-8 text-center space-y-3">
            <FileText className="h-12 w-12 text-[#C9A84C]/30 mx-auto" />
            <p className="font-bold text-muted-foreground">لا توجد قضايا مرتبطة بعد</p>
            <p className="text-xs text-muted-foreground">أضف رابط البوابة الذي أرسله لك محامك لربط قضيتك بحسابك</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />قضاياي ({cases.length})
            </h2>
            {cases.map((c: any) => {
              const st = STATUS_AR[c.case_status] ?? STATUS_AR.open;
              return (
                <div key={c.case_id}
                  className="bg-[#0a1520] border border-[#C9A84C]/15 rounded-2xl p-4 hover:border-[#C9A84C]/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                        <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                        {c.case_type && (
                          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                            {TYPE_AR[c.case_type] ?? c.case_type}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-sm truncate">{c.case_title ?? "قضية قانونية"}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {c.linked_at ? new Date(c.linked_at).toLocaleDateString("ar-SA") : "—"}
                      </p>
                    </div>
                    {c.portal_token && (
                      <a href={`${BASE.replace(/\/$/, "")}/portal/${c.portal_token}`}
                        className="flex items-center gap-1.5 bg-[#C9A84C] text-[#0d1b2a] font-bold text-xs px-3 py-2 rounded-xl hover:bg-[#b8933e] transition-colors whitespace-nowrap shrink-0">
                        <ExternalLink className="h-3.5 w-3.5" />فتح ملف القضية
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Link new case */}
        <div className="bg-[#0a1520] border border-white/5 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2 text-muted-foreground">
            <Link2 className="h-4 w-4" />ربط قضية جديدة
          </h3>
          <p className="text-xs text-muted-foreground">
            الصق رابط البوابة أو رمز الوصول الذي أرسله لك محامك
          </p>
          <div className="flex gap-2">
            <input
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && linkToken()}
              placeholder="https://...portal/abc123  أو  abc123"
              className="flex-1 bg-[#0d1b2a] border border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-[#C9A84C]/60 placeholder:text-muted-foreground/40"
            />
            <button onClick={linkToken} disabled={linking || !linkInput}
              className="px-4 py-2.5 bg-[#C9A84C] text-[#0d1b2a] font-bold rounded-xl text-sm flex items-center gap-1.5 hover:bg-[#b8933e] transition-colors disabled:opacity-50">
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              ربط
            </button>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 text-center justify-center pb-6">
          <Shield className="h-3 w-3" />
          حسابك محمي — جميع الاتصالات مشفرة
        </div>
      </div>
    </div>
  );
}
