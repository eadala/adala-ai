import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Scale, FileText, Bot, Users, CreditCard, Menu, Search,
  Sparkles, LogOut, Swords, Zap, UserCircle, BookOpen, Handshake, LibraryBig,
  AlertTriangle, BarChart3, Shield, UserCog, Clock, CalendarDays, DollarSign,
  Building2, Gavel, MessageCircle, Globe, Receipt, Mail, ShoppingBag, Crown,
  BrainCircuit, Lock, Database, TrendingUp, TrendingDown, ArrowRightLeft,
  Landmark, Wallet, BarChart2, Cpu, HardDrive, Bell, Mail as MailIcon, MessageSquare,
  FileSignature, Palette, ClipboardList, LifeBuoy, Network, Award, Activity,
} from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useBranding } from "@/hooks/use-branding";
import { useOfficePlan } from "@/hooks/use-office-plan";
import { NotificationsPanel } from "@/components/notifications-panel";
import { AccountMenu } from "@/components/account-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser, useClerk } from "@clerk/react";
import { useLoginTracker } from "@/hooks/useLoginTracker";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<any>;
  feature?: string;
}
interface NavGroup {
  labelKey: string;
  superAdminOnly?: boolean;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.groups.legal_ops",
    items: [
      { href: "/dashboard",  labelKey: "nav.items.dashboard",  icon: LayoutDashboard },
      { href: "/cases",      labelKey: "nav.items.cases",      icon: Scale },
      { href: "/clients",    labelKey: "nav.items.clients",    icon: UserCircle },
      { href: "/contracts",          labelKey: "nav.items.contracts",          icon: FileText },
      { href: "/documents",          labelKey: "nav.items.documents",          icon: BookOpen },
      { href: "/document-templates", labelKey: "nav.items.documentTemplates",  icon: FileSignature },
      { href: "/letters",            labelKey: "nav.items.letters",            icon: Mail },
    ],
  },
  {
    labelKey: "nav.groups.financial",
    items: [
      { href: "/finance",           labelKey: "nav.items.finance_center",    icon: DollarSign },
      { href: "/invoices",          labelKey: "nav.items.invoices",          icon: Receipt },
      { href: "/collections",       labelKey: "nav.items.collections",       icon: TrendingUp },
      { href: "/billing",           labelKey: "nav.items.billing",           icon: CreditCard },
      { href: "/payment-center",    labelKey: "nav.items.payment_center",    icon: Landmark },
      { href: "/revenues",          labelKey: "nav.items.revenues",          icon: TrendingUp },
      { href: "/expenses",          labelKey: "nav.items.expenses",          icon: TrendingDown },
      { href: "/cashflow",          labelKey: "nav.items.cashflow",          icon: ArrowRightLeft },
      { href: "/bank-accounts",     labelKey: "nav.items.bank_accounts",     icon: Landmark },
      { href: "/advances",          labelKey: "nav.items.advances",          icon: Wallet },
      { href: "/financial-reports", labelKey: "nav.items.financial_reports", icon: BarChart2 },
    ],
  },
  {
    labelKey: "nav.groups.communication",
    items: [
      { href: "/messages",             labelKey: "nav.items.messages",              icon: MessageCircle },
      { href: "/support",              labelKey: "nav.items.support",               icon: LifeBuoy },
      { href: "/reminders",            labelKey: "nav.items.reminders",             icon: Bell },
      { href: "/calendar",             labelKey: "nav.items.calendar",              icon: CalendarDays,  feature: "calendar" },
      { href: "/client-portal",        labelKey: "nav.items.client_portal",         icon: Globe,         feature: "clientPortal" },
      { href: "/email-notifications",  labelKey: "nav.items.email_notifications",   icon: MailIcon },
      { href: "/whatsapp-settings",    labelKey: "nav.items.whatsapp",              icon: MessageSquare },
    ],
  },
  {
    labelKey: "nav.groups.ai",
    items: [
      { href: "/ai-hub",             labelKey: "nav.items.ai_hub",             icon: Sparkles,    feature: "ai" },
      { href: "/ai-agents",          labelKey: "nav.items.ai_agents",          icon: Bot,         feature: "ai" },
      { href: "/legal-research",     labelKey: "nav.items.legal_research",     icon: LibraryBig,  feature: "ai" },
      { href: "/judge-prep",         labelKey: "nav.items.judge_prep",         icon: Gavel,       feature: "ai" },
      { href: "/opponent-simulator", labelKey: "nav.items.opponent_simulator", icon: Swords,      feature: "ai" },
      { href: "/arbitration",        labelKey: "nav.items.arbitration",        icon: Handshake,   feature: "ai" },
      { href: "/legal-ai",           labelKey: "nav.items.legal_ai",           icon: Scale,       feature: "ai" },
    ],
  },
  {
    labelKey: "nav.groups.hr",
    items: [
      { href: "/hr-center",   labelKey: "nav.items.hr_center",   icon: Award },
      { href: "/hr-systems",  labelKey: "nav.items.hr_systems",  icon: Building2 },
      { href: "/employees",  labelKey: "nav.items.employees",  icon: UserCog },
      { href: "/attendance", labelKey: "nav.items.attendance", icon: Clock },
      { href: "/leaves",     labelKey: "nav.items.leaves",     icon: CalendarDays },
      { href: "/payroll",    labelKey: "nav.items.payroll",    icon: DollarSign },
      { href: "/warnings",   labelKey: "nav.items.warnings",   icon: AlertTriangle },
      { href: "/tasks",      labelKey: "nav.items.tasks",      icon: ClipboardList },
    ],
  },
  {
    labelKey: "nav.groups.analytics",
    items: [
      { href: "/analytics",                labelKey: "nav.items.performance_analytics",   icon: BarChart3,     feature: "advancedReports" },
      { href: "/financial-intelligence",   labelKey: "nav.items.financial_intelligence",  icon: BrainCircuit },
      { href: "/risk-management",          labelKey: "nav.items.risk_management",         icon: AlertTriangle, feature: "advancedReports" },
      { href: "/audit-logs",               labelKey: "nav.items.audit_logs",             icon: Activity },
      { href: "/compliance",               labelKey: "nav.items.compliance",              icon: Shield },
      { href: "/login-tracking",           labelKey: "nav.items.login_tracking",          icon: Lock },
    ],
  },
  {
    labelKey: "nav.groups.website",
    items: [
      { href: "/office-management", labelKey: "nav.items.office_management", icon: Globe,       feature: "website" },
      { href: "/marketplace",       labelKey: "nav.items.marketplace",       icon: ShoppingBag, feature: "serviceStore" },
      { href: "/mediators",         labelKey: "nav.items.mediators",         icon: Handshake },
    ],
  },
  {
    labelKey: "nav.groups.admin",
    items: [
      { href: "/firm-admin",      labelKey: "nav.items.firm_admin",      icon: Crown },
      { href: "/org-structure",   labelKey: "nav.items.org_structure",   icon: Network },
      { href: "/users",           labelKey: "nav.items.users",           icon: Users },
      { href: "/office-settings",  labelKey: "nav.items.office_settings",  icon: Building2 },
      { href: "/theme-builder",   labelKey: "nav.items.theme_builder",   icon: Palette },
      { href: "/backup",            labelKey: "nav.items.backup_center",      icon: Database },
      { href: "/storage-settings", labelKey: "nav.items.storage_settings",   icon: HardDrive },
    ],
  },
  {
    labelKey: "nav.groups.super_admin",
    superAdminOnly: true,
    items: [
      { href: "/super-admin", labelKey: "nav.items.super_admin_panel", icon: Shield },
      { href: "/studio",      labelKey: "nav.items.studio",            icon: Cpu },
    ],
  },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function OfficeLogo() {
  const { data: branding } = useBranding();
  const { t } = useTranslation();
  const primary = branding?.primaryColor || "#1e3a5f";
  return (
    <div className="flex h-16 items-center px-4 border-b border-sidebar-border gap-3 shrink-0">
      {branding?.logoUrl ? (
        <img src={branding.logoUrl} alt={branding.officeName || t("appName")}
          className="h-9 w-9 object-contain rounded-md bg-white/10 p-0.5" />
      ) : (
        <div className="h-9 w-9 rounded-md flex items-center justify-center text-white font-bold text-base shrink-0"
          style={{ backgroundColor: primary }}>
          {(branding?.officeName || t("appName"))[0]}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-bold tracking-tight text-white truncate leading-tight">
          {branding?.officeName || t("appName")}
        </span>
        {branding?.tagline && (
          <span className="text-[10px] text-sidebar-foreground/50 truncate leading-tight">
            {branding.tagline}
          </span>
        )}
      </div>
    </div>
  );
}

function NavItemLink({ item, isActive, onClick, badge }: { item: NavItem; isActive: boolean; onClick?: () => void; badge?: number }) {
  const { hasFeature, isLoaded } = useOfficePlan();
  const { t } = useTranslation();
  const isAI = ["/ai-hub", "/command-center", "/ai-agents", "/ai-chat", "/opponent-simulator", "/ai-assistant", "/legal-research", "/judge-prep", "/arbitration", "/legal-ai"].includes(item.href);
  const isLocked = isLoaded && item.feature ? !hasFeature(item.feature) : false;
  const label = t(item.labelKey);

  const baseClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full text-right";
  const activeClass = "bg-sidebar-accent text-sidebar-accent-foreground";
  const inactiveClass = "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground";
  const lockedClass = "text-sidebar-foreground/40 cursor-default";

  if (isLocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/billing" className={`${baseClass} ${lockedClass}`} onClick={onClick}>
            <item.icon className="h-4 w-4 flex-shrink-0 opacity-40" />
            <span className="truncate flex-1">{label}</span>
            <Lock className="h-3 w-3 opacity-50 flex-shrink-0" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-48">
          {t("featureLocked")}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={item.href} className={`${baseClass} ${isActive ? activeClass : inactiveClass}`} onClick={onClick}>
      <item.icon className={`h-4 w-4 flex-shrink-0 ${isAI ? "text-[#C9A84C]" : ""}`} />
      <span className="truncate flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { t, i18n } = useTranslation();

  /* Sync dir on language change */
  useEffect(() => {
    document.documentElement.dir  = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const displayName = isLoaded && user
    ? user.fullName || user.emailAddresses[0]?.emailAddress?.split("@")[0] || t("systemAdmin")
    : t("systemAdmin");

  const initials = displayName.slice(0, 2);

  const userEmail = user?.emailAddresses[0]?.emailAddress ?? "";
  const ownerEmail = (import.meta.env.VITE_PLATFORM_OWNER_EMAIL ?? "").trim();
  const isSuperAdminByEmail = !!ownerEmail && userEmail === ownerEmail;
  const isSuperAdminByRole = user?.publicMetadata?.role === "super_admin";
  const isSuperAdmin = isSuperAdminByEmail || isSuperAdminByRole;

  useLoginTracker();

  /* ── Onboarding redirect (T002) ── */
  const { data: onboardingState } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetch(`${basePath}/api/onboarding/state`).then(r => r.json()),
    enabled: isLoaded && !!user,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (
      isLoaded && user && onboardingState &&
      !onboardingState.completed &&
      location !== "/onboarding"
    ) {
      navigate("/onboarding");
    }
  }, [isLoaded, user, onboardingState?.completed, location]);

  /* ── Reminders count for badge (T003) ── */
  const { data: remindersData } = useQuery({
    queryKey: ["reminders-count"],
    queryFn: () => fetch(`${basePath}/api/reminders/count`).then(r => r.json()),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const pendingRemindersCount: number = remindersData?.count ?? 0;

  const visibleGroups = NAV_GROUPS.filter((g) => !g.superAdminOnly || isSuperAdmin);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <OfficeLogo />
        <div className="flex-1 overflow-y-auto py-3">
          <nav className="px-3 space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.labelKey}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-1">
                  {t(group.labelKey)}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                    return <NavItemLink key={item.href} item={item} isActive={isActive} badge={item.href === "/reminders" ? pendingRemindersCount : undefined} />;
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
              <span className="text-xs text-sidebar-foreground/60">{t("systemAdmin")}</span>
            </div>
            <Button variant="ghost" size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent/50"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              title={t("logout")}>
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
            <OfficeLogo />
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
              {visibleGroups.map((group) => (
                <div key={group.labelKey}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-2 mb-1">
                    {t(group.labelKey)}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                      return <NavItemLink key={item.href} item={item} isActive={isActive} onClick={() => setIsMobileMenuOpen(false)} badge={item.href === "/reminders" ? pendingRemindersCount : undefined} />;
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
              <span className="text-lg font-bold text-foreground">{t("appName")}</span>
            </div>
          </div>

          <div className="hidden md:flex flex-1 items-center max-w-md">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("search")}
                className="w-full pl-4 pr-10 bg-muted/50 border-none focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 mr-auto">
            <LanguageSwitcher />
            <NotificationsPanel />
            <AccountMenu />
            {/* ── زر الخروج الظاهر ── */}
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              title="تسجيل الخروج"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                text-red-400 border border-red-500/20 bg-red-500/5
                hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-300
                transition-all duration-150 mr-1 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
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
