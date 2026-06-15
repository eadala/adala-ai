import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Scale, FileText, Bot, Users, CreditCard, Menu, Search,
  Sparkles, LogOut, Swords, Zap, UserCircle, BookOpen, Handshake, LibraryBig,
  AlertTriangle, BarChart3, Shield, UserCog, Clock, CalendarDays, DollarSign,
  Building2, Gavel, MessageCircle, Globe, Receipt, Mail, ShoppingBag, Crown,
  BrainCircuit, Lock, Database, TrendingUp, TrendingDown, ArrowRightLeft,
  Landmark, Wallet, BarChart2, Cpu, HardDrive, Bell, Mail as MailIcon, MessageSquare,
  FileSignature, Palette, ClipboardList, LifeBuoy, Network, Award, Activity, Send,
  ChevronDown, Briefcase, Wand2,
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
import { FloatingCopilot } from "@/components/floating-copilot";
import { CommandBar } from "@/components/command-bar";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<any>;
  feature?: string;
}

interface OperatingCenterDef {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  items: NavItem[];
  superAdminOnly?: boolean;
}

/* ══════════════════════════════════════════════════════════════
   Domain-Driven Architecture — 3 Domains + 3 Engines + Platform
   Case | CRM | Contracts  →  Docs | Comms | Productivity
══════════════════════════════════════════════════════════════ */
const OPERATING_CENTERS: OperatingCenterDef[] = [
  /* ─── Domain 1: Case Management Core ─── */
  {
    id: "cases",
    label: "إدارة القضايا",
    icon: Scale,
    color: "#6366F1",
    items: [
      { href: "/dashboard", labelKey: "nav.items.dashboard", icon: LayoutDashboard },
      { href: "/cases",     labelKey: "nav.items.cases",     icon: Scale },
      { href: "/calendar",  labelKey: "nav.items.calendar",  icon: CalendarDays, feature: "calendar" },
      { href: "/tasks",     labelKey: "nav.items.tasks",     icon: ClipboardList },
      { href: "/reminders", labelKey: "nav.items.reminders", icon: Bell },
    ],
  },
  /* ─── Domain 2: CRM Layer ─── */
  {
    id: "crm",
    label: "إدارة العملاء",
    icon: UserCircle,
    color: "#0EA5E9",
    items: [
      { href: "/clients",       labelKey: "nav.items.clients",       icon: UserCircle },
      { href: "/client-portal", labelKey: "nav.items.client_portal", icon: Globe, feature: "clientPortal" },
      { href: "/mediators",     labelKey: "nav.items.mediators",     icon: Handshake },
    ],
  },
  /* ─── Domain 3: Contracts + Document Engine ─── */
  {
    id: "docs",
    label: "العقود والمستندات",
    icon: FileSignature,
    color: "#8B5CF6",
    items: [
      { href: "/contracts",          labelKey: "nav.items.contracts",         icon: Handshake },
      { href: "/documents",          labelKey: "nav.items.documents",         icon: BookOpen },
      { href: "/document-templates", labelKey: "nav.items.documentTemplates", icon: FileSignature },
      { href: "/letters",            labelKey: "nav.items.letters",           icon: Mail },
    ],
  },
  /* ─── Engine 1: AI Center ─── */
  {
    id: "ai",
    label: "مركز الذكاء الاصطناعي",
    icon: Sparkles,
    color: "#2563EB",
    items: [
      { href: "/ai-copilot",          labelKey: "nav.items.ai_copilot",          icon: BrainCircuit, feature: "ai" },
      { href: "/ai-hub",             labelKey: "nav.items.ai_hub",             icon: Sparkles,   feature: "ai" },
      { href: "/adoul",              labelKey: "nav.items.adoul",              icon: Scale,      feature: "ai" },
      { href: "/ui-builder",         labelKey: "nav.items.ui_builder",         icon: Wand2,      feature: "ai" },
      { href: "/ai-agents",          labelKey: "nav.items.ai_agents",          icon: Bot,        feature: "ai" },
      { href: "/legal-ai",           labelKey: "nav.items.legal_ai",           icon: Scale,      feature: "ai" },
      { href: "/legal-research",     labelKey: "nav.items.legal_research",     icon: LibraryBig, feature: "ai" },
      { href: "/judge-prep",         labelKey: "nav.items.judge_prep",         icon: Gavel,      feature: "ai" },
      { href: "/opponent-simulator", labelKey: "nav.items.opponent_simulator", icon: Swords,     feature: "ai" },
      { href: "/arbitration",        labelKey: "nav.items.arbitration",        icon: Handshake,  feature: "ai" },
    ],
  },
  /* ─── Engine 2: Financial Operations ─── */
  {
    id: "finance",
    label: "العمليات المالية",
    icon: DollarSign,
    color: "#10B981",
    items: [
      { href: "/finance",           labelKey: "nav.items.finance_center",    icon: DollarSign },
      { href: "/invoices",          labelKey: "nav.items.invoices",          icon: Receipt },
      { href: "/collections",       labelKey: "nav.items.collections",       icon: TrendingUp },
      { href: "/payment-center",    labelKey: "nav.items.payment_center",    icon: Landmark },
      { href: "/revenues",          labelKey: "nav.items.revenues",          icon: TrendingUp },
      { href: "/expenses",          labelKey: "nav.items.expenses",          icon: TrendingDown },
      { href: "/cashflow",          labelKey: "nav.items.cashflow",          icon: ArrowRightLeft },
      { href: "/bank-accounts",     labelKey: "nav.items.bank_accounts",     icon: Landmark },
      { href: "/advances",          labelKey: "nav.items.advances",          icon: Wallet },
      { href: "/financial-reports",    labelKey: "nav.items.financial_reports",    icon: BarChart2 },
      { href: "/financial-statements", labelKey: "nav.items.financial_statements", icon: Scale },
      { href: "/financial-core",       labelKey: "nav.items.financial_core",       icon: BarChart3 },
      { href: "/billing",           labelKey: "nav.items.billing",           icon: CreditCard },
    ],
  },
  /* ─── Engine 3: Communication Hub ─── */
  {
    id: "comms",
    label: "مركز الاتصالات",
    icon: MessageCircle,
    color: "#3B82F6",
    items: [
      { href: "/messages",            labelKey: "nav.items.messages",            icon: MessageCircle },
      { href: "/email-notifications", labelKey: "nav.items.email_notifications", icon: MailIcon },
      { href: "/whatsapp-settings",   labelKey: "nav.items.whatsapp",            icon: MessageSquare },
      { href: "/telegram-settings",   labelKey: "nav.items.telegram",            icon: Send },
      { href: "/office-management",   labelKey: "nav.items.office_management",   icon: Globe,       feature: "website" },
      { href: "/marketplace",         labelKey: "nav.items.marketplace",         icon: ShoppingBag, feature: "serviceStore" },
      { href: "/support",             labelKey: "nav.items.support",             icon: LifeBuoy },
    ],
  },
  /* ─── Platform: HR ─── */
  {
    id: "hr",
    label: "رأس المال البشري",
    icon: Users,
    color: "#F59E0B",
    items: [
      { href: "/hr-center",  labelKey: "nav.items.hr_center",  icon: Award },
      { href: "/hr-systems", labelKey: "nav.items.hr_systems", icon: Building2 },
      { href: "/employees",  labelKey: "nav.items.employees",  icon: UserCog },
      { href: "/attendance", labelKey: "nav.items.attendance", icon: Clock },
      { href: "/leaves",     labelKey: "nav.items.leaves",     icon: CalendarDays },
      { href: "/payroll",    labelKey: "nav.items.payroll",    icon: DollarSign },
      { href: "/warnings",   labelKey: "nav.items.warnings",   icon: AlertTriangle },
    ],
  },
  /* ─── Platform: Analytics & Settings ─── */
  {
    id: "analytics",
    label: "التحليلات والإعدادات",
    icon: BarChart3,
    color: "#EC4899",
    items: [
      { href: "/analytics",              labelKey: "nav.items.performance_analytics",  icon: BarChart3,     feature: "advancedReports" },
      { href: "/financial-intelligence", labelKey: "nav.items.financial_intelligence", icon: BrainCircuit },
      { href: "/risk-management",        labelKey: "nav.items.risk_management",        icon: AlertTriangle, feature: "advancedReports" },
      { href: "/activity-stream",        labelKey: "nav.items.activity_stream",        icon: Activity },
      { href: "/audit-logs",             labelKey: "nav.items.audit_logs",             icon: Activity },
      { href: "/compliance",             labelKey: "nav.items.compliance",             icon: Shield },
      { href: "/login-tracking",         labelKey: "nav.items.login_tracking",         icon: Lock },
      { href: "/firm-admin",             labelKey: "nav.items.firm_admin",             icon: Crown },
      { href: "/org-structure",          labelKey: "nav.items.org_structure",          icon: Network },
      { href: "/team",                   labelKey: "nav.items.team_permissions",       icon: Shield },
      { href: "/users",                  labelKey: "nav.items.users",                  icon: Users },
      { href: "/office-settings",        labelKey: "nav.items.office_settings",        icon: Building2 },
      { href: "/theme-builder",          labelKey: "nav.items.theme_builder",          icon: Palette },
      { href: "/backup",                 labelKey: "nav.items.backup_center",          icon: Database },
      { href: "/storage-settings",       labelKey: "nav.items.storage_settings",       icon: HardDrive },
    ],
  },
  /* ─── Platform: Super Admin ─── */
  {
    id: "superadmin",
    label: "إدارة المنصة",
    icon: Shield,
    color: "#EF4444",
    superAdminOnly: true,
    items: [
      { href: "/super-admin",        labelKey: "nav.items.super_admin_panel", icon: Shield },
      { href: "/studio",             labelKey: "nav.items.studio",            icon: Cpu },
      { href: "/engineering-center", labelKey: "مركز الهندسة",               icon: Briefcase },
      { href: "/monitoring",         labelKey: "مركز المراقبة والإصلاح",     icon: Activity },
      { href: "/prevention",         labelKey: "منع الانهيار",               icon: Shield },
      { href: "/alerts",             labelKey: "التنبيهات الذكية",           icon: Bell },
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
        <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate leading-tight">
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

function NavItemLink({ item, isActive, onClick, badge, accentColor }: {
  item: NavItem; isActive: boolean; onClick?: () => void; badge?: number; accentColor?: string;
}) {
  const { hasFeature, isLoaded } = useOfficePlan();
  const { t } = useTranslation();
  const isLocked = isLoaded && item.feature ? !hasFeature(item.feature) : false;
  const label = t(item.labelKey);

  const baseClass = "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all w-full text-right";

  if (isLocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/billing" className={`${baseClass} text-sidebar-foreground/40 cursor-default`} onClick={onClick}>
            <item.icon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
            <span className="truncate flex-1">{label}</span>
            <Lock className="h-3 w-3 opacity-50 flex-shrink-0" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-48">{t("featureLocked")}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      className={`${baseClass} ${
        isActive
          ? "text-primary font-semibold"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
      }`}
      style={isActive && accentColor ? { backgroundColor: `${accentColor}18`, borderRight: `2px solid ${accentColor}` } : {}}
      onClick={onClick}
    >
      <item.icon
        className="h-3.5 w-3.5 flex-shrink-0"
        style={isActive && accentColor ? { color: accentColor } : {}}
      />
      <span className="truncate flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

/* ── Collapsible Operating Center block ── */
function OperatingCenter({
  center, location, pendingRemindersCount, onItemClick,
}: {
  center: OperatingCenterDef;
  location: string;
  pendingRemindersCount: number;
  onItemClick?: () => void;
}) {
  const isAnyActive = center.items.some(
    item => location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href))
  );
  const [open, setOpen] = useState(isAnyActive);

  useEffect(() => {
    if (isAnyActive) setOpen(true);
  }, [isAnyActive]);

  const CenterIcon = center.icon;

  return (
    <div>
      {/* Center header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all mb-0.5 ${
          isAnyActive
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
        }`}
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isAnyActive ? `${center.color}25` : "transparent" }}
        >
          <CenterIcon className="h-3 w-3" style={{ color: isAnyActive ? center.color : "currentColor" }} />
        </div>
        <span className="flex-1 text-right truncate leading-tight">{center.label}</span>
        <ChevronDown
          className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: isAnyActive ? center.color : "currentColor" }}
        />
      </button>

      {/* Items */}
      {open && (
        <div className="mb-2 space-y-0.5 pr-2 mr-3 border-r border-dashed" style={{ borderColor: `${center.color}35` }}>
          {center.items.map((item) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <NavItemLink
                key={item.href}
                item={item}
                isActive={isActive}
                onClick={onItemClick}
                badge={item.href === "/reminders" ? pendingRemindersCount : undefined}
                accentColor={center.color}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrialBanner() {
  const { isTrial, trialDaysLeft } = useOfficePlan();
  if (!isTrial) return null;
  const urgent = (trialDaysLeft ?? 30) <= 7;
  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium z-50 shrink-0 ${urgent ? "bg-amber-50 border-b border-amber-200 text-amber-700" : "bg-blue-50 border-b border-blue-100 text-blue-700"}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">🎁</span>
        <span>
          فترة تجريبية مجانية — جميع الميزات مفعّلة
          {trialDaysLeft != null && (
            <span className={`mr-1 font-bold ${urgent ? "text-amber-800" : "text-blue-800"}`}>
              ({trialDaysLeft} {trialDaysLeft === 1 ? "يوم" : "أيام"} متبقية)
            </span>
          )}
        </span>
      </div>
      <a href="/billing" className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${urgent ? "border-amber-300 text-amber-700 hover:bg-amber-100" : "border-blue-200 text-blue-700 hover:bg-blue-100"}`}>
        اشترك الآن
      </a>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { t, i18n } = useTranslation();

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
  const isSuperAdmin =
    (!!ownerEmail && userEmail === ownerEmail) ||
    user?.publicMetadata?.role === "super_admin";

  useLoginTracker();

  const { data: onboardingState } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetch(`${basePath}/api/onboarding/state`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: isLoaded && !!user,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (isLoaded && user && onboardingState && !onboardingState.completed && location !== "/onboarding") {
      navigate("/onboarding");
    }
  }, [isLoaded, user, onboardingState?.completed, location]);

  const { data: remindersData } = useQuery({
    queryKey: ["reminders-count"],
    queryFn: () => fetch(`${basePath}/api/reminders/count`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const pendingRemindersCount: number = remindersData?.count ?? 0;

  useEffect(() => { setIsMobileMenuOpen(false); }, [location]);
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  const visibleCenters = OPERATING_CENTERS.filter(c => !c.superAdminOnly || isSuperAdmin);

  const SidebarNav = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="px-2 py-2 space-y-0.5">
      {visibleCenters.map((center) => (
        <OperatingCenter
          key={center.id}
          center={center}
          location={location}
          pendingRemindersCount={pendingRemindersCount}
          onItemClick={onItemClick}
        />
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden w-64 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <OfficeLogo />
        <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          <SidebarNav />
        </div>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
              <AvatarFallback className="bg-sidebar-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</span>
              <span className="text-xs text-sidebar-foreground/60">{t("systemAdmin")}</span>
            </div>
            <Button variant="ghost" size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              title={t("logout")}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Menu ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside
            className="absolute right-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-sidebar border-l border-sidebar-border flex flex-col shadow-2xl"
            style={{ animation: "slideInFromRight 0.22s ease-out" }}
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-1 border-b border-sidebar-border/50">
              <OfficeLogo />
              <Button variant="ghost" size="icon"
                className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
                onClick={() => setIsMobileMenuOpen(false)}>
                <span className="text-lg leading-none">✕</span>
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              <SidebarNav onItemClick={() => setIsMobileMenuOpen(false)} />
            </div>
            <div className="border-t border-sidebar-border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-sidebar-border">
                  {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
                  <AvatarFallback className="bg-sidebar-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500/70 hover:text-red-500"
                  onClick={() => signOut({ redirectUrl: basePath || "/" })}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
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

          {/* ⌘K Command Bar Trigger */}
          <div className="hidden md:flex flex-1 items-center max-w-sm">
            <button
              onClick={() => (window as any).__openCommandBar?.()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-border transition-all text-sm text-muted-foreground group"
            >
              <Search className="h-3.5 w-3.5 shrink-0 group-hover:text-foreground transition-colors" />
              <span className="flex-1 text-right text-[13px]">ابحث أو اكتب أمراً...</span>
              <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono border border-border/60 rounded px-1.5 py-0.5 bg-background/60 shrink-0">
                <span className="text-[11px]">⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1 mr-auto">
            <LanguageSwitcher />
            <NotificationsPanel />
            <AccountMenu />
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              title="تسجيل الخروج"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-300 transition-all duration-150 mr-1 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </header>

        <TrialBanner />

        <div className="flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>

      <FloatingCopilot />
      <CommandBar />
    </div>
  );
}
