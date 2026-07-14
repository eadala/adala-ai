/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState, useRef, useEffect } from "react";
import { useUser, useClerk, useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsSuperAdmin } from "@/hooks/use-role";
import { useBranding } from "@/hooks/use-branding";
import {
  User, Building2, Shield, KeyRound, Monitor,
  Settings, Bell, Globe2, BookOpen, MessageCircle,
  LogOut, ChevronDown, Check, Plus,
  Crown, ChevronRight, AlertTriangle, Code2, Briefcase,
  Sparkles, Fingerprint, XCircle,
} from "lucide-react";
import { DEV_API } from "@/features/super-admin/shared/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function MenuItem({
  icon: Icon, label, desc, href, onClick, badge, danger = false, disabled = false, highlight = false,
}: {
  icon: any; label: string; desc?: string; href?: string;
  onClick?: () => void; badge?: string | number;
  danger?: boolean; disabled?: boolean; highlight?: boolean;
}) {
  const [, setLocation] = useLocation();
  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    if (href) setLocation(href);
  };
  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition-all group
        ${danger
          ? "hover:bg-red-50 text-red-500 hover:text-red-600"
          : highlight
            ? "bg-primary/5 hover:bg-primary/10 text-primary"
            : disabled
              ? "opacity-40 cursor-not-allowed text-muted-foreground"
              : "hover:bg-muted/60 text-foreground"
        }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
        ${danger ? "bg-red-50 group-hover:bg-red-100"
          : highlight ? "bg-primary/10"
          : "bg-muted group-hover:bg-muted/80"}`}>
        <Icon className={`h-4 w-4 ${danger ? "text-red-500" : highlight ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <div className="text-sm font-medium leading-tight">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{desc}</div>}
      </div>
      {badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{badge}</span>
      )}
    </button>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px mx-2 bg-border/60 my-1" />;
}

export function AccountMenu() {
  const { toast } = useToast();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [officeOpen, setOfficeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: branding } = useBranding();

  const isSuperAdmin = useIsSuperAdmin();
  const qc = useQueryClient();
  const { getToken } = useAuth();

  /* Direct API call using Clerk token — avoids _getToken singleton */
  const devFetch = async (path: string, opts?: RequestInit) => {
    const token = await getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${basePath}/api/developer${path}`, { headers, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const { data: ghostStatus } = useQuery<any>({
    queryKey: ["ghost", "status"],
    queryFn: () => devFetch("/impersonate/status"),
    enabled: isSuperAdmin,
    refetchInterval: 60_000,
    retry: false,
  });

  const exitGhost = useMutation({
    mutationFn: () => devFetch("/impersonate", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ghost"] });
      setOpen(false);
      window.location.href = `${basePath}/super-admin`;
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),

  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setOfficeOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!isLoaded || !user) return null;

  const displayName = user.fullName || user.emailAddresses[0]?.emailAddress?.split("@")[0] || "مستخدم";
  const email = user.emailAddresses[0]?.emailAddress ?? "";
  const initials = (user.fullName ?? email).slice(0, 2).toUpperCase();
  const officeName = branding?.officeName ?? "مكتب المحاماة";
  const role = (user.publicMetadata?.role as string) ?? "admin";
  const roleLabel: Record<string, string> = {
    admin: "مدير النظام", lawyer: "محامٍ", paralegal: "مساعد قانوني",
    viewer: "مراقب", super_admin: "مالك المنصة",
  };
  const userRole = isSuperAdmin ? "مالك المنصة" : (roleLabel[role] ?? "عضو");

  const handleSignOut = () => {
    setOpen(false);
    signOut({ redirectUrl: `${basePath}/` });
  };

  const handleSignOutAll = () => {
    setOpen(false);
    setLocation(`${basePath}/my-profile`);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all border
          ${open
            ? "border-primary/30 bg-primary/5 shadow-sm"
            : "border-transparent hover:border-border hover:bg-muted/50"
          }`}
        aria-label="قائمة الحساب"
      >
        <Avatar className="h-8 w-8 border-2 flex-shrink-0 border-primary/20">
          {user.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden lg:flex flex-col items-end min-w-0 max-w-[120px]">
          <span className="text-sm font-semibold text-foreground truncate leading-tight">{displayName}</span>
          <span className="text-[11px] text-primary truncate leading-tight">{userRole}</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform text-muted-foreground ${open ? "rotate-180" : ""}`} />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute left-0 top-12 z-50 rounded-2xl shadow-xl border border-border bg-card animate-in slide-in-from-top-2 fade-in-0 duration-200 flex flex-col"
          style={{ width: "308px", maxHeight: "calc(100vh - 80px)", boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)" }}
        >
          {/* ── Identity Card ── */}
          <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  {user.imageUrl && <AvatarImage src={user.imageUrl} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {isSuperAdmin && (
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md bg-primary">
                    <Crown className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground text-sm leading-tight truncate">{displayName}</div>
                <div className="text-xs text-primary mt-0.5 font-medium">{userRole}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground truncate">{officeName}</span>
                </div>
              </div>
            </div>

            {/* Email chip */}
            <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/60">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate flex-1">{email}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">نشط</span>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1 min-h-0">
            <Divider />

            {/* ── Office Switcher ── */}
            <div className="p-2">
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => setOfficeOpen(v => !v)}
              >
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground text-right truncate">{officeName}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${officeOpen ? "rotate-180" : ""}`} />
              </button>

              {officeOpen && (
                <div className="mt-1 mx-1 rounded-xl border border-border bg-background p-1.5 animate-in slide-in-from-top-1 fade-in-0 duration-150">
                  <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-primary/5 border border-primary/15">
                    <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground font-medium flex-1 truncate">{officeName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">حالي</span>
                  </div>
                  <button
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg mt-1 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                    onClick={() => { setOpen(false); setLocation("/office-settings"); }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-sm">إضافة مكتب جديد</span>
                  </button>
                </div>
              )}
            </div>

            <Divider />

            {/* ── الحساب ── */}
            <div className="p-2 space-y-0.5">
              <SectionLabel label="الحساب" />
              <MenuItem icon={User} label="الملف الشخصي" desc="عرض وتعديل بياناتك"
                href="/my-profile" onClick={() => setOpen(false)} />
              <MenuItem icon={Shield} label="إعدادات الأمان" desc="كلمة المرور والتحقق الثنائي"
                href="/my-profile" onClick={() => setOpen(false)} />
              <MenuItem icon={KeyRound} label="تغيير كلمة المرور"
                href="/my-profile" onClick={() => setOpen(false)} />
              <MenuItem icon={Monitor} label="جلساتي وأجهزتي" desc="تتبع جميع عمليات الدخول"
                href="/my-sessions" onClick={() => setOpen(false)} />
            </div>

            <Divider />

            {/* ── الإدارة ── */}
            <div className="p-2 space-y-0.5">
              <SectionLabel label="الإدارة" />
              <MenuItem icon={Settings} label="إعدادات النظام"
                href="/office-settings" onClick={() => setOpen(false)} />
              <MenuItem icon={Bell} label="تفضيلات الإشعارات"
                href="/office-settings" onClick={() => setOpen(false)} />
              <MenuItem icon={Globe2} label="اللغة" desc="العربية — AR" disabled badge="قريباً" />
            </div>

            {/* ── مالك المنصة ── */}
            {isSuperAdmin && (
              <>
                <Divider />
                <div className="p-2 space-y-0.5">
                  <SectionLabel label="صلاحيات مالك المنصة" />

                  {/* Ghost mode active banner */}
                  {ghostStatus?.active && (
                    <div className="mx-1 mb-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/25 animate-pulse">
                      <Fingerprint className="h-4 w-4 text-violet-400 flex-shrink-0 animate-none" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-violet-300 leading-tight">وضع الدخول الخفي</div>
                        <div className="text-[10px] text-violet-400/80 truncate leading-tight">{ghostStatus.officeName}</div>
                      </div>
                      <button
                        onClick={() => exitGhost.mutate()}
                        disabled={exitGhost.isPending}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-semibold transition-colors flex-shrink-0"
                      >
                        <XCircle className="h-3 w-3" />
                        خروج
                      </button>
                    </div>
                  )}

                  <MenuItem icon={Crown} label="لوحة التحكم العليا" desc="إدارة المنصة كاملاً"
                    highlight href="/super-admin" onClick={() => setOpen(false)} />
                  <MenuItem icon={Code2} label="لوحة المطور" desc="API · DB · Impersonation"
                    href="/super-admin?tab=developer" onClick={() => setOpen(false)} />
                  <MenuItem icon={Briefcase} label="لوحة مدير المكتب"
                    href="/firm-admin" onClick={() => setOpen(false)} />
                </div>
              </>
            )}

            {/* ── مدير المكتب فقط ── */}
            {!isSuperAdmin && role === "admin" && (
              <>
                <Divider />
                <div className="p-2 space-y-0.5">
                  <SectionLabel label="إدارة المكتب" />
                  <MenuItem icon={Briefcase} label="لوحة مدير المكتب" desc="الفريق والصلاحيات"
                    href="/firm-admin" onClick={() => setOpen(false)} />
                </div>
              </>
            )}

            <Divider />

            {/* ── الدعم ── */}
            <div className="p-2 pb-3 space-y-0.5">
              <SectionLabel label="الدعم" />
              <MenuItem icon={BookOpen} label="مركز المساعدة" desc="الوثائق والأدلة"
                onClick={() => { setOpen(false); window.open("https://docs.adalaai.com", "_blank"); }} />
              <MenuItem icon={MessageCircle} label="تواصل مع الدعم الفني"
                href="/messages" onClick={() => setOpen(false)} />
            </div>
          </div>

          {/* ── زر الخروج — مثبّت في الأسفل دائماً ── */}
          <div className="border-t border-border p-2 pb-3 space-y-1 flex-shrink-0 bg-card rounded-b-2xl">
            <button
              onClick={handleSignOutAll}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors group text-right"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted group-hover:bg-red-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-muted-foreground group-hover:text-red-500 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground group-hover:text-red-600">تسجيل الخروج من جميع الأجهزة</div>
                <div className="text-[11px] text-muted-foreground">إنهاء جميع الجلسات النشطة</div>
              </div>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group
                bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 group-hover:bg-red-200 transition-colors flex-shrink-0">
                <LogOut className="h-4 w-4 text-red-500" />
              </div>
              <span className="flex-1 text-sm font-semibold text-red-500 group-hover:text-red-600 text-right">
                تسجيل الخروج
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-red-300 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
