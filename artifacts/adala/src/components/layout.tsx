import { Link, useLocation } from "wouter";
import { LayoutDashboard, Scale, FileText, Bot, Users, MessageSquare, CreditCard, Menu, Search, Sparkles, LogOut, Swords, Zap, UserCircle, BookOpen, Handshake, LibraryBig, AlertTriangle, BarChart3, Shield, UserCog, Clock, CalendarDays, DollarSign, Building2, Gavel, MessageCircle, Globe, Receipt, Mail, ShoppingBag, Crown } from "lucide-react";
import { ReactNode, useState } from "react";
import { NotificationsPanel } from "@/components/notifications-panel";
import { AccountMenu } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useClerk } from "@clerk/react";

const NAV_GROUPS = [
  {
    label: "الإدارة",
    items: [
      { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
      { href: "/messages", label: "مراسلات", icon: MessageCircle },
      { href: "/cases", label: "القضايا", icon: Scale },
      { href: "/contracts", label: "العقود", icon: FileText },
      { href: "/clients", label: "العملاء (CRM)", icon: UserCircle },
      { href: "/invoices", label: "الفواتير", icon: Receipt },
      { href: "/calendar", label: "التقويم والمواعيد", icon: CalendarDays },
      { href: "/client-portal", label: "بوابة العملاء", icon: Globe },
      { href: "/documents", label: "المستندات", icon: BookOpen },
      { href: "/letters", label: "نماذج الخطابات", icon: Mail },
    ],
  },
  {
    label: "الذكاء الاصطناعي",
    items: [
      { href: "/command-center", label: "مركز الأوامر", icon: Zap },
      { href: "/ai-agents", label: "الوكلاء الذكيون", icon: Bot },
      { href: "/ai-chat", label: "المساعد الذكي", icon: Sparkles },
      { href: "/opponent-simulator", label: "محاكي الخصم", icon: Swords },
      { href: "/judge-prep", label: "توقع أسئلة القاضي", icon: Gavel },
      { href: "/legal-research", label: "البحث القانوني", icon: LibraryBig },
      { href: "/arbitration", label: "التحكيم والوساطة", icon: Handshake },
    ],
  },
  {
    label: "الموارد البشرية",
    items: [
      { href: "/employees", label: "الموظفون", icon: UserCog },
      { href: "/attendance", label: "الحضور والانصراف", icon: Clock },
      { href: "/leaves", label: "الإجازات", icon: CalendarDays },
      { href: "/payroll", label: "الرواتب", icon: DollarSign },
      { href: "/warnings", label: "الإنذارات والتحقيقات", icon: AlertTriangle },
    ],
  },
  {
    label: "التحليل والمخاطر",
    items: [
      { href: "/analytics", label: "تحليلات الأداء", icon: BarChart3 },
      { href: "/risk-management", label: "إدارة المخاطر", icon: AlertTriangle },
      { href: "/compliance", label: "الامتثال القانوني", icon: Shield },
    ],
  },
  {
    label: "الموقع القانوني",
    items: [
      { href: "/office-management", label: "الموقع الذكي للمكتب", icon: Globe },
      { href: "/marketplace", label: "السوق القانوني", icon: ShoppingBag },
    ],
  },
  {
    label: "النظام",
    items: [
      { href: "/firm-admin", label: "لوحة مدير المكتب", icon: Crown },
      { href: "/users", label: "فريق العمل", icon: Users },
      { href: "/billing", label: "الاشتراك والفوترة", icon: CreditCard },
      { href: "/office-settings", label: "إعدادات المكتب", icon: Building2 },
    ],
  },
  {
    label: "Super Admin",
    superAdminOnly: true,
    items: [
      { href: "/super-admin", label: "لوحة التحكم العليا", icon: Shield },
    ],
  },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const displayName = isLoaded && user
    ? user.fullName || user.emailAddresses[0]?.emailAddress?.split("@")[0] || "مستخدم"
    : "مستخدم";

  const initials = displayName.slice(0, 2);
  const role = "مدير النظام";

  const userEmail = user?.emailAddresses[0]?.emailAddress ?? "";
  const ownerEmail = (import.meta.env.VITE_PLATFORM_OWNER_EMAIL ?? "").trim();
  const isSuperAdminByEmail = !!ownerEmail && userEmail === ownerEmail;
  const isSuperAdminByRole = user?.publicMetadata?.role === "super_admin";
  const isSuperAdmin = isSuperAdminByEmail || isSuperAdminByRole;

  const visibleGroups = NAV_GROUPS.filter((g: any) => !g.superAdminOnly || isSuperAdmin);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - RTL */}
      <aside className="hidden w-64 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-sidebar-primary" />
            <span className="text-xl font-bold tracking-tight text-white">عدالة AI</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <nav className="px-3 space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-1">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                    const isAI = ["/command-center", "/ai-agents", "/ai-chat", "/opponent-simulator"].includes(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 flex-shrink-0 ${isAI ? "text-[#C9A84C]" : ""}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
              <AvatarFallback className="bg-sidebar-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium text-white truncate">{displayName}</span>
              <span className="text-xs text-sidebar-foreground/60">{role}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent/50"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute right-0 top-0 bottom-0 w-64 bg-sidebar border-l border-sidebar-border flex flex-col">
            <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
              <Scale className="h-6 w-6 text-sidebar-primary ml-2" />
              <span className="text-xl font-bold text-white">عدالة AI</span>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-1">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                          }`}>
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
          <div className="flex items-center md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="mr-4 flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold text-foreground">عدالة AI</span>
            </div>
          </div>

          <div className="hidden md:flex flex-1 items-center max-w-md">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث في القضايا والمستندات..."
                className="w-full pl-4 pr-10 bg-muted/50 border-none focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mr-auto">
            <NotificationsPanel />
            <AccountMenu />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
