/**
 * Platform Admin Layout — عدالة AI
 * مخصص حصراً لـ platform_admin — هوية المنصة الأبيض/الأزرق
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Shield, BarChart3, Users, CreditCard, Globe, Database,
  Code2, Server, Settings, LogOut, Menu, X, ChevronRight,
  Zap, Building2, Coins, Landmark, Activity, GitBranch,
  BookOpen, Crown, LayoutDashboard,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "المنصة",
    items: [
      { href: "/super-admin",    label: "لوحة التحكم",        icon: LayoutDashboard },
      { href: "/financial-core", label: "النواة المالية",      icon: BarChart3 },
      { href: "/audit-logs",     label: "سجل المراجعة",        icon: Activity },
    ],
  },
  {
    label: "المستخدمون",
    items: [
      { href: "/super-admin?tab=offices",  label: "المكاتب القانونية", icon: Building2 },
      { href: "/super-admin?tab=users",    label: "المستخدمون",        icon: Users },
      { href: "/super-admin?tab=tenants",  label: "المستأجرون",        icon: Globe },
    ],
  },
  {
    label: "المالية",
    items: [
      { href: "/super-admin?tab=billing",    label: "الاشتراكات",        icon: CreditCard },
      { href: "/super-admin?tab=promo",      label: "كودات الترويج",     icon: Coins },
      { href: "/super-admin?tab=revenue",    label: "إيرادات المنصة",    icon: Landmark },
      { href: "/payment-center",             label: "مركز المدفوعات",    icon: Landmark },
    ],
  },
  {
    label: "البنية التحتية",
    items: [
      { href: "/super-admin?tab=hosting",   label: "الاستضافة",         icon: Server },
      { href: "/super-admin?tab=storage",   label: "التخزين",           icon: Database },
      { href: "/super-admin?tab=developer", label: "مركز المطور",        icon: Code2 },
      { href: "/studio",                    label: "Adala Studio",       icon: GitBranch },
    ],
  },
  {
    label: "المحتوى",
    items: [
      { href: "/super-admin?tab=plans-cms", label: "إدارة الخطط",       icon: BookOpen },
      { href: "/super-admin?tab=home-cms",  label: "محتوى الصفحة",      icon: Globe },
      { href: "/super-admin?tab=platform",  label: "وحدات المنصة",      icon: Settings },
    ],
  },
];

function NavLink({ item }: { item: AdminNavItem }) {
  const [location] = useLocation();
  const href = `${BASE}${item.href}`;
  const isActive = location === item.href || (item.href !== "/super-admin" && location.startsWith(item.href.split("?")[0]));
  const Icon = item.icon;

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        window.history.pushState({}, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
        isActive
          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <Badge className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20">
          {item.badge}
        </Badge>
      )}
    </a>
  );
}

function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const initials = (user?.fullName || user?.primaryEmailAddress?.emailAddress || "A")
    .slice(0, 2).toUpperCase();

  return (
    <div
      dir="rtl"
      className="flex flex-col h-full bg-card border-l border-border text-foreground w-64 shrink-0"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-foreground">عدالة AI</p>
            <p className="text-[10px] text-primary font-medium leading-tight">لوحة المنصة</p>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground md:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Platform badge ── */}
      <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15 flex items-center gap-2">
        <Crown className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-primary">Platform Admin</span>
        <div className="mr-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {ADMIN_NAV.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider px-3 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href + item.label} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-border p-3 shrink-0 space-y-1">
        <a
          href={`${BASE}/dashboard`}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span>عودة للوحة المكتب</span>
          <ChevronRight className="h-3.5 w-3.5 mr-auto" />
        </a>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/50">
          <Avatar className="h-7 w-7 border border-primary/20 shrink-0">
            {user?.imageUrl && <AvatarImage src={user.imageUrl} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {user?.fullName || "المسؤول"}
            </p>
            <p className="text-[10px] text-primary">مالك المنصة</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: `${BASE}/` })}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20" dir="rtl">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <AdminSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 shadow-2xl">
            <AdminSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile only) */}
        <div className="flex md:hidden items-center justify-between h-14 px-4 border-b border-border bg-card">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">لوحة المنصة</span>
          </div>
          <div className="w-8" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full text-foreground">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
