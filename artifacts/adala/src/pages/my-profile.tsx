/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-non-null-assertion, react-hooks/exhaustive-deps -- pre-existing lint debt; authFetch migration */
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  User, Mail, Phone, Shield, KeyRound, LogOut, Camera,
  Building2, Clock, Check, ArrowRight, Sparkles, Bell,
  Monitor, Activity, Lock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/30">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-bold text-foreground text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

export default function MyProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, nav] = useLocation();
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [saved, setSaved]         = useState(false);

  const { data: officeData } = useQuery<any>({
    queryKey: ["office-profile"],
    queryFn: () => authFetch(`${BASE}/api/users`).then(r => r.ok ? r.json() : null).catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  /* redirect when not signed in — must be BEFORE conditional returns */
  useEffect(() => {
    if (isLoaded && !user) nav(`${BASE}/sign-in`);
  }, [isLoaded, user]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  /* ── derive display values — user is narrowed to UserResource here ── */
  const u = user;
  const displayName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.primaryEmailAddress?.emailAddress || "مستخدم";
  const email       = u.primaryEmailAddress?.emailAddress ?? "";
  const phone       = u.primaryPhoneNumber?.phoneNumber ?? "";
  const initials    = displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const joined      = u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }) : "";
  const lastActive  = u.updatedAt ? new Date(u.updatedAt).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }) : "";

  const hasPassword = u.passwordEnabled;
  const has2FA      = u.twoFactorEnabled;

  async function handleSave() {
    if (!firstName && !lastName) return;
    setSaving(true);
    try {
      await u.update({ firstName: firstName || u.firstName!, lastName: lastName || u.lastName! });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/5 via-card to-card border border-border rounded-2xl p-6 flex items-center gap-5">
        <div className="relative">
          <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
            {u.imageUrl && <AvatarImage src={u.imageUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black">{initials}</AvatarFallback>
          </Avatar>
          <button
            title="تغيير الصورة"
            onClick={() => { const i = document.createElement("input"); i.type="file"; i.accept="image/*"; i.onchange=(e:any)=>{ const f=e.target.files?.[0]; if(f) u.setProfileImage({file:f}); }; i.click(); }}
            className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity">
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-foreground truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="text-xs gap-1">
              <Check className="h-3 w-3 text-emerald-500" />
              حساب نشط
            </Badge>
            {has2FA && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Shield className="h-3 w-3 text-blue-500" />
                2FA مفعّل
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="text-[10px] text-muted-foreground">انضم</p>
          <p className="text-xs font-medium text-foreground">{joined}</p>
        </div>
      </motion.div>

      {/* Edit name */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Section title="تعديل الاسم" icon={User}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">الاسم الأول</label>
              <input
                type="text"
                defaultValue={u.firstName ?? ""}
                onChange={e => setFirstName(e.target.value)}
                placeholder={u.firstName ?? "الاسم الأول"}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">اسم العائلة</label>
              <input
                type="text"
                defaultValue={u.lastName ?? ""}
                onChange={e => setLastName(e.target.value)}
                placeholder={u.lastName ?? "اسم العائلة"}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || (!firstName && !lastName)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-all">
            {saving ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "تم الحفظ!" : saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </button>
        </Section>
      </motion.div>

      {/* Account info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Section title="معلومات الحساب" icon={Mail}>
          <Field label="البريد الإلكتروني" value={email} icon={Mail} />
          <Field label="رقم الهاتف" value={phone || "غير مضاف"} icon={Phone} />
          <Field label="آخر نشاط" value={lastActive} icon={Clock} />
          <Field label="تاريخ الإنضمام" value={joined} icon={Activity} />
        </Section>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Section title="الأمان والخصوصية" icon={Shield}>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <KeyRound className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">كلمة المرور</p>
                  <p className="text-xs text-muted-foreground">{hasPassword ? "كلمة مرور مضبوطة" : "لم تُضبط بعد"}</p>
                </div>
              </div>
              <a href={`${BASE}/sign-in`}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                تغيير <ArrowRight className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/60">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${has2FA ? "bg-emerald-50" : "bg-amber-50"}`}>
                  <Lock className={`h-4 w-4 ${has2FA ? "text-emerald-600" : "text-amber-600"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">التحقق الثنائي (2FA)</p>
                  <p className={`text-xs font-medium ${has2FA ? "text-emerald-600" : "text-amber-600"}`}>
                    {has2FA ? "✓ مفعّل" : "غير مفعّل — يُنصح بتفعيله"}
                  </p>
                </div>
              </div>
              <button onClick={() => nav(`${BASE}/2fa-setup`)}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${has2FA ? "text-emerald-600" : "text-amber-600"}`}>
                {has2FA ? "إدارة" : "تفعيل"} <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Monitor className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">الجلسات والأجهزة</p>
                  <p className="text-xs text-muted-foreground">إدارة جميع جلسات الدخول</p>
                </div>
              </div>
              <button onClick={() => nav(`${BASE}/my-sessions`)}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                عرض <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </Section>
      </motion.div>

      {/* Quick links */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Section title="روابط سريعة" icon={Sparkles}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "إعدادات المكتب",   icon: Building2, href: "/office-settings" },
              { label: "تفضيلات الإشعارات", icon: Bell,      href: "/office-settings" },
              { label: "الجلسات والأمان",   icon: Monitor,   href: "/my-sessions"     },
              { label: "سجل التدقيق",       icon: Activity,  href: "/audit-logs"      },
            ].map(l => (
              <button key={l.label} onClick={() => nav(`${BASE}${l.href}`)}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-right">
                <l.icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-medium text-foreground">{l.label}</span>
              </button>
            ))}
          </div>
        </Section>
      </motion.div>

      {/* Sign out */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <button
          onClick={() => signOut({ redirectUrl: `${BASE}/` })}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-colors">
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </motion.div>
    </div>
  );
}
