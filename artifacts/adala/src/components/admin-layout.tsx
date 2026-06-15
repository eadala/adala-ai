/**
 * Platform Admin Layout — عدالة AI
 * مخصص حصراً لـ platform_admin — لا يرى sidebar المكاتب القانونية
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, BarChart3, Users, CreditCard, Globe, Database,
  Code2, Server, Settings, LogOut, Menu, X, ChevronRight,
  Zap, Building2, Lock, Coins, Landmark, LifeBuoy,
  BookOpen, Activity, GitBranch,
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
      { href: "/super-admin",    label: "لوحة التحكم",        icon: Shield },
      { href: "/financial-core", label: "النواة المالية",      icon: BarChart3 },
      { href: "/audit-logs",     label: "سجل المراجعة",        icon: Activity },
    ],
  },
  {
    label: "إدارة المستخدمين",
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
      onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", href); window.dispatchEvent(new PopStateEvent("popstate")); }}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
        isActive
          ? "bg-primary text-primary-foreground font-medium"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <Badge className="text-[10px] h-4 px-1.5 bg-amber-500/20 text-amber-300 border-amber-500/30">{item.badge}</Badge>
      )}
    </a>
  );
}

function AdminSidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const { user } = useUser();

  return (
    <div
      dir="rtl"
      className={cn(
        "flex flex-col h-full bg-[#0a0f1e] border-l border-border text-white",
        "w-64 shrink-0",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">عدالة AI</p>
            <p className="text-[10px] text-indigo-300 leading-tight">Platform Admin</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10 md:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {ADMIN_NAV.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1.5">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => <NavLink key={item.href + item.label} item={item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 shrink-0 space-y-1">
        <a
          href={`${BASE}/dashboard`}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Building2 className="h-4 w-4" />
          <span>إعدادات المكتب</span>
          <ChevronRight className="h-3 w-3 mr-auto" />
        </a>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="h-7 w-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
            {(user?.fullName || user?.primaryEmailAddress?.emailAddress || "A")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{user?.fullName || "المسؤول"}</p>
            <p className="text-[10px] text-indigo-400">platform_admin</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1224]" dir="rtl">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <AdminSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10">
            <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <div className="flex md:hidden items-center justify-between h-14 px-4 border-b border-border bg-[#0a0f1e]">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-bold text-white">لوحة المنصة</span>
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
