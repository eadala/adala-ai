import { useState, useRef, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  User, Building2, RefreshCw, Shield, KeyRound, Smartphone,
  Settings, Bell, Moon, Sun, Globe2, BookOpen, MessageCircle,
  LogOut, LogIn, ChevronDown, Check, Plus, Monitor,
  Crown, ChevronRight, ExternalLink, AlertTriangle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Branding { officeName?: string | null; logoUrl?: string | null; primaryColor?: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────
const GOLD = "#2563EB";
const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function MenuItem({
  icon: Icon, label, desc, href, onClick, color, badge, danger = false, disabled = false
}: {
  icon: any; label: string; desc?: string; href?: string;
  onClick?: () => void; color?: string; badge?: string | number;
  danger?: boolean; disabled?: boolean;
}) {
  const [, setLocation] = useLocation();
  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    else if (href) setLocation(href);
  };
  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all group
        ${danger
          ? "hover:bg-red-500/10 text-red-400 hover:text-red-300"
          : disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-muted/30 text-[#C8D3E8]"
        }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
        ${danger ? "bg-red-500/12 group-hover:bg-red-500/20" : "bg-muted/30 group-hover:bg-white/10"}`}
        style={!danger && color ? { background: `${color}18` } : undefined}>
        <Icon className="h-4 w-4" style={{ color: danger ? undefined : color ?? "#A0ADB8" }} />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <div className={`text-sm font-medium leading-tight ${danger ? "" : "group-hover:text-white"}`}>{label}</div>
        {desc && <div className="text-[11px] text-[#6B7A99] mt-0.5 leading-tight">{desc}</div>}
      </div>
      {badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{badge}</span>
      )}
    </button>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7A99]">{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AccountMenu() {
  const { user, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("adala-theme") as "dark" | "light") || "light";
  });
  const [officeOpen, setOfficeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("adala-theme", theme);
  }, [theme]);

  const { data: branding } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => fetch("/api/branding").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  // Close on outside click
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
  const initials = (user.fullName ?? email).slice(0, 2);
  const officeName = branding?.officeName ?? "مكتب المحاماة";
  const role = (user.publicMetadata?.role as string) ?? "admin";
  const roleLabel: Record<string, string> = {
    admin: "مدير النظام", lawyer: "محامٍ", paralegal: "مساعد قانوني",
    viewer: "مراقب", super_admin: "مالك المنصة",
  };
  const userRole = roleLabel[role] ?? "عضو";
  const isSuperAdmin = role === "super_admin" ||
    email === (import.meta.env.VITE_PLATFORM_OWNER_EMAIL ?? "").trim();

  const handleSignOut = () => {
    setOpen(false);
    signOut({ redirectUrl: `${basePath}/` });
  };

  const handleSignOutAll = () => {
    setOpen(false);
    // Clerk doesn't have a built-in "sign out all" but we open the profile for session management
    openUserProfile({ initialPage: "security" } as any);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all border
          ${open
            ? "border-[#3D4F7C] bg-[#243058] shadow-lg"
            : "border-transparent hover:border-[#E2E8F0] hover:bg-[#1F2E54]"
          }`}
        aria-label="قائمة الحساب"
      >
        {/* Avatar */}
        <Avatar className="h-8 w-8 border-2 flex-shrink-0"
          style={{ borderColor: open ? GOLD : "rgba(201,168,76,0.3)" }}>
          {user.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
          <AvatarFallback
            style={{ background: `${GOLD}20`, color: GOLD }}
            className="text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Name + role (desktop only) */}
        <div className="hidden lg:flex flex-col items-end min-w-0 max-w-[130px]">
          <span className="text-sm font-semibold text-white truncate leading-tight">{displayName}</span>
          <span className="text-[11px] truncate leading-tight" style={{ color: `${GOLD}CC` }}>{userRole}</span>
        </div>

        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform text-[#6B7A99] ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-12 z-50 w-80 rounded-2xl shadow-2xl border overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200"
          style={{
            background: "linear-gradient(180deg, #1E2D52 0%, #19274A 100%)",
            borderColor: "#E2E8F0",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* ── User Identity Card ── */}
          <div className="px-4 pt-4 pb-3" style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.07), transparent)" }}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12 border-2" style={{ borderColor: GOLD }}>
                  {user.imageUrl && <AvatarImage src={user.imageUrl} />}
                  <AvatarFallback style={{ background: `${GOLD}20`, color: GOLD }} className="text-base font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {isSuperAdmin && (
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                    style={{ background: GOLD }}>
                    <Crown className="h-2.5 w-2.5 text-[#FFFFFF]" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm leading-tight truncate">{displayName}</div>
                <div className="text-xs mt-0.5 leading-tight" style={{ color: `${GOLD}CC` }}>{userRole}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Building2 className="h-3 w-3 text-[#6B7A99] flex-shrink-0" />
                  <span className="text-[11px] text-[#A0ADB8] truncate">{officeName}</span>
                </div>
              </div>
            </div>

            {/* Email chip */}
            <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(45,61,107,0.5)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-[11px] text-[#A0ADB8] truncate flex-1">{email}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                نشط
              </span>
            </div>
          </div>

          <div className="h-px mx-3" style={{ background: "rgba(45,61,107,0.8)" }} />

          {/* ── Office Switcher ── */}
          <div className="p-2">
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted/30 transition-colors"
              onClick={() => setOfficeOpen(v => !v)}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${GOLD}20` }}>
                <Building2 className="h-3.5 w-3.5" style={{ color: GOLD }} />
              </div>
              <span className="flex-1 text-sm font-medium text-[#C8D3E8] text-right truncate">{officeName}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-[#6B7A99] transition-transform ${officeOpen ? "rotate-180" : ""}`} />
            </button>

            {officeOpen && (
              <div className="mt-1 mx-1 rounded-xl border p-1.5 animate-in slide-in-from-top-1 fade-in-0 duration-150"
                style={{ borderColor: "#E2E8F0", background: "rgba(26,39,68,0.8)" }}>
                {/* Current office */}
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                  style={{ background: `${GOLD}10` }}>
                  <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: GOLD }} />
                  <span className="text-sm text-white font-medium flex-1 truncate">{officeName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: `${GOLD}20`, color: GOLD }}>حالي</span>
                </div>
                {/* Add new office */}
                <button
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg mt-1 hover:bg-muted/30 transition-colors text-[#A0ADB8] hover:text-white"
                  onClick={() => { setOpen(false); setLocation("/office-settings"); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-sm">إضافة مكتب جديد</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-px mx-3" style={{ background: "rgba(45,61,107,0.8)" }} />

          {/* ── Sections ── */}
          <div className="p-2 space-y-0.5">
            <SectionLabel label="الحساب" />

            <MenuItem
              icon={User} label="الملف الشخصي" desc="عرض وتعديل بياناتك الشخصية"
              color="#6366F1" onClick={() => { setOpen(false); openUserProfile(); }}
            />
            <MenuItem
              icon={Shield} label="إعدادات الأمان" desc="كلمة المرور والتحقق الثنائي"
              color="#10B981" href="/office-settings" onClick={() => setOpen(false)}
            />
            <MenuItem
              icon={KeyRound} label="تغيير كلمة المرور"
              color="#F59E0B" onClick={() => { setOpen(false); openUserProfile({ initialPage: "security" } as any); }}
            />
            <MenuItem
              icon={Smartphone} label="جلساتي وأجهزتي" desc="عرض وتتبع جميع عمليات الدخول"
              color="#8B5CF6" href="/my-sessions" onClick={() => setOpen(false)}
            />
          </div>

          <div className="h-px mx-3" style={{ background: "rgba(45,61,107,0.6)" }} />

          <div className="p-2 space-y-0.5">
            <SectionLabel label="الإدارة" />

            <MenuItem
              icon={Settings} label="إعدادات النظام" color="#94A3B8"
              href="/office-settings" onClick={() => setOpen(false)}
            />
            <MenuItem
              icon={Bell} label="تفضيلات الإشعارات" color="#06B6D4"
              href="/office-settings" onClick={() => setOpen(false)}
            />
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 text-[#C8D3E8] hover:text-white transition-all group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/30 group-hover:bg-white/10">
                {theme === "dark"
                  ? <Moon className="h-4 w-4 text-[#A0ADB8]" />
                  : <Sun className="h-4 w-4" style={{ color: GOLD }} />}
              </div>
              <span className="flex-1 text-sm font-medium text-right">
                {theme === "dark" ? "الوضع الليلي" : "الوضع النهاري"}
              </span>
              <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${theme === "dark" ? "bg-indigo-600" : "bg-amber-500"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${theme === "dark" ? "right-0.5" : "left-0.5"}`} />
              </div>
            </button>

            <MenuItem
              icon={Globe2} label="اللغة" desc="العربية — AR" color="#A0ADB8" disabled
              badge="قريباً"
            />
          </div>

          {isSuperAdmin && (
            <>
              <div className="h-px mx-3" style={{ background: "rgba(45,61,107,0.6)" }} />
              <div className="p-2 space-y-0.5">
                <SectionLabel label="صلاحيات خاصة" />
                <MenuItem
                  icon={Crown} label="لوحة التحكم العليا" desc="إدارة المنصة"
                  color={GOLD} href="/super-admin" onClick={() => setOpen(false)}
                />
                <MenuItem
                  icon={Settings} label="لوحة مدير المكتب"
                  color="#6366F1" href="/firm-admin" onClick={() => setOpen(false)}
                />
              </div>
            </>
          )}

          <div className="h-px mx-3" style={{ background: "rgba(45,61,107,0.6)" }} />

          <div className="p-2 space-y-0.5">
            <SectionLabel label="الدعم" />
            <MenuItem
              icon={BookOpen} label="مركز المساعدة" desc="الوثائق والأدلة"
              color="#A0ADB8"
              onClick={() => { setOpen(false); window.open("https://docs.adalaai.com", "_blank"); }}
            />
            <MenuItem
              icon={MessageCircle} label="تواصل مع الدعم الفني"
              color="#06B6D4" href="/messages" onClick={() => setOpen(false)}
            />
          </div>

          <div className="h-px mx-3" style={{ background: "rgba(45,61,107,0.6)" }} />

          {/* ── Danger Zone ── */}
          <div className="p-2 pb-3 space-y-0.5">
            <MenuItem
              icon={AlertTriangle} label="تسجيل الخروج من جميع الأجهزة"
              desc="إنهاء جميع الجلسات النشطة"
              danger onClick={handleSignOutAll}
            />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group
                bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/30"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/15 group-hover:bg-red-500/25 transition-colors">
                <LogOut className="h-4 w-4 text-red-400" />
              </div>
              <span className="flex-1 text-sm font-semibold text-red-400 group-hover:text-red-300 text-right">
                تسجيل الخروج
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-red-500/50 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
