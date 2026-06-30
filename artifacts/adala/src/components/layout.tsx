import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Scale, FileText, Bot, Users, CreditCard, Menu, Search,
  Sparkles, LogOut, Swords, Zap, UserCircle, BookOpen, Handshake, LibraryBig,
  AlertTriangle, BarChart3, Shield, ShieldCheck, UserCog, Clock, CalendarDays, DollarSign,
  Building2, Gavel, MessageCircle, Globe, Receipt, Mail, ShoppingBag, Crown,
  BrainCircuit, Lock, Database, TrendingUp, TrendingDown, ArrowRightLeft,
  Landmark, Wallet, BarChart2, Cpu, HardDrive, Bell, Mail as MailIcon, MessageSquare,
  FileSignature, Palette, ClipboardList, LifeBuoy, Network, Award, Activity, Send,
  ChevronDown, Briefcase, Wand2, X, BellRing, GitBranch, Plug, Rocket, Brain,
  Layout as LayoutIcon, FolderOpen, Target, BrainCog, Settings2,
  ChevronLeft, ChevronRight, Star, StarOff, History, Pin, PinOff,
  CircleDot, Circle, Minus, Settings, HelpCircle, SwitchCamera,
  CheckCircle2, Wifi, WifiOff, Building, UserCheck,
} from "lucide-react";
import { ReactNode, useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { useUser, useClerk } from "@clerk/react";
import { useLoginTracker } from "@/hooks/useLoginTracker";
import { useIsSuperAdmin } from "@/hooks/use-role";
import { usePermissions } from "@/hooks/use-permissions";
import { FloatingCopilot } from "@/components/floating-copilot";
import { CommandBar } from "@/components/command-bar";

/* ══════════════════════════════════════════════════════════════════════════
   TYPE DEFINITIONS
══════════════════════════════════════════════════════════════════════════ */
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  feature?: string;
  superAdminOnly?: boolean;
  permission?: string;
  badge?: "reminders" | "messages";
  tag?: "new" | "beta" | "pro";
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  items: NavItem[];
  superAdminOnly?: boolean;
  standalone?: boolean;
  lockFeature?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION ARCHITECTURE — Enterprise SaaS
   Follows: Primary → Operational → Specialized → Platform
══════════════════════════════════════════════════════════════════════════ */
const NAV_SECTIONS: NavSection[] = [
  /* ── 1. لوحة التحكم ─────────────────────────────────────────────── */
  {
    id: "dashboard",
    label: "لوحة التحكم",
    icon: LayoutDashboard,
    color: "#2563EB",
    items: [
      { href: "/dashboard",          label: "الرئيسية",           icon: LayoutDashboard },
      { href: "/firm-admin",         label: "لوحة مدير المكتب",   icon: Crown },
      { href: "/executive-dashboard",label: "لوحة القيادة التنفيذية", icon: BarChart3, superAdminOnly: true },
    ],
  },

  /* ── 2. إدارة القضايا ─────────────────────────────────────────────── */
  {
    id: "cases",
    label: "إدارة القضايا",
    icon: Scale,
    color: "#6366F1",
    items: [
      { href: "/cases",              label: "القضايا",             icon: Scale },
      { href: "/hearings-calendar",  label: "الجلسات",             icon: Gavel },
      { href: "/calendar",           label: "التقويم",             icon: CalendarDays,   feature: "calendar" },
      { href: "/tasks",              label: "المهام",              icon: ClipboardList },
      { href: "/reminders",          label: "التذكيرات",           icon: Bell,           badge: "reminders" },
      { href: "/messages",           label: "المراسلات",           icon: MessageCircle,  badge: "messages" },
      { href: "/document-center",    label: "الأرشيف القضائي",     icon: FolderOpen },
    ],
  },

  /* ── 3. إدارة العملاء ─────────────────────────────────────────────── */
  {
    id: "crm",
    label: "إدارة العملاء",
    icon: UserCircle,
    color: "#0EA5E9",
    items: [
      { href: "/clients",       label: "العملاء",           icon: UserCircle },
      { href: "/client-portal", label: "بوابة العميل",       icon: Globe,      feature: "clientPortal" },
      { href: "/mediators",     label: "الوسطاء والوكلاء",   icon: Handshake },
      { href: "/marketplace",   label: "سوق الخدمات",        icon: ShoppingBag, feature: "serviceStore" },
    ],
  },

  /* ── 4. العقود والمستندات ─────────────────────────────────────────── */
  {
    id: "docs",
    label: "العقود والمستندات",
    icon: FileSignature,
    color: "#8B5CF6",
    items: [
      { href: "/contracts",          label: "العقود",              icon: Handshake },
      { href: "/documents",          label: "المستندات",           icon: BookOpen },
      { href: "/document-templates", label: "النماذج والقوالب",    icon: FileSignature },
      { href: "/letters",            label: "المراسلات الرسمية",   icon: Mail },
      { href: "/storage-settings",   label: "إدارة التخزين الذكي", icon: HardDrive },
    ],
  },

  /* ── 5. العمليات المالية ─────────────────────────────────────────── */
  {
    id: "finance",
    label: "العمليات المالية",
    icon: DollarSign,
    color: "#10B981",
    items: [
      { href: "/finance",              label: "مركز المالية",          icon: DollarSign },
      { href: "/invoices",             label: "الفواتير",              icon: Receipt },
      { href: "/collections",          label: "التحصيل والمطالبات",    icon: TrendingUp },
      { href: "/payment-center",       label: "مركز المدفوعات",        icon: Landmark },
      { href: "/revenues",             label: "الإيرادات",             icon: TrendingUp,     permission: "financial:view" },
      { href: "/expenses",             label: "المصروفات",             icon: TrendingDown,   permission: "financial:view" },
      { href: "/cashflow",             label: "التدفق النقدي",          icon: ArrowRightLeft, permission: "financial:view" },
      { href: "/bank-accounts",        label: "الحسابات البنكية",      icon: Landmark,       permission: "financial:view" },
      { href: "/advances",             label: "السُّلف والمدفوعات",    icon: Wallet,         permission: "financial:view" },
      { href: "/tax-settings",         label: "إعدادات الضريبة",       icon: Settings2,      permission: "financial:view" },
      { href: "/financial-reports",    label: "التقارير المالية",       icon: BarChart2 },
      { href: "/financial-statements", label: "القوائم المالية",        icon: Scale },
      { href: "/financial-core",       label: "المحرك المالي الموحّد",  icon: BarChart3 },
      { href: "/enterprise-finance",   label: "المالية الاحترافية ERP", icon: Scale },
      { href: "/billing",              label: "الاشتراك والباقات",     icon: CreditCard },
    ],
  },

  /* ── 6. مركز الذكاء الاصطناعي ────────────────────────────────────── */
  {
    id: "ai",
    label: "مركز الذكاء الاصطناعي",
    icon: Sparkles,
    color: "#7C3AED",
    items: [
      { href: "/ai-hub",              label: "مركز الذكاء",          icon: BrainCircuit,  feature: "ai" },
      { href: "/ai-coo",              label: "المدير التنفيذي الذكي", icon: Brain,         feature: "ai" },
      { href: "/legal-ai",            label: "محرك الوثائق القانونية",icon: Scale,         feature: "ai" },
      { href: "/judge-prep",          label: "المحاكاة القضائية",     icon: Gavel,         feature: "ai" },
      { href: "/ai-copilot",          label: "المساعد القانوني",      icon: Bot,           feature: "ai" },
      { href: "/ai-workflow-builder", label: "بناء سير العمل الذكي",  icon: GitBranch,     superAdminOnly: true },
      { href: "/financial-intelligence", label: "الذكاء المالي",      icon: TrendingUp },
    ],
  },

  /* ── 7. عدالة إفلاس (Standalone Module) ──────────────────────────── */
  {
    id: "bankruptcy",
    label: "عدالة إفلاس",
    icon: Landmark,
    color: "#DC2626",
    standalone: true,
    lockFeature: "bankruptcy",
    items: [
      { href: "/bankruptcy",             label: "لوحة الإفلاس",          icon: Landmark },
      { href: "/bankruptcy/cases",       label: "قضايا الإفلاس",         icon: Scale },
      { href: "/bankruptcy/creditors",   label: "الدائنون",              icon: Users },
      { href: "/bankruptcy/assets",      label: "الأصول والتصفية",       icon: Database },
      { href: "/bankruptcy/reports",     label: "التقارير والوثائق",      icon: FileText },
    ],
  },

  /* ── 8. مركز الاتصالات ────────────────────────────────────────────── */
  {
    id: "comms",
    label: "مركز الاتصالات",
    icon: MessageCircle,
    color: "#3B82F6",
    items: [
      { href: "/email-notifications",   label: "البريد الإلكتروني",    icon: MailIcon },
      { href: "/whatsapp-settings",     label: "واتساب",               icon: MessageSquare },
      { href: "/telegram-settings",     label: "تيليجرام",             icon: Send },
      { href: "/notification-settings", label: "إعدادات الإشعارات",    icon: BellRing },
      { href: "/integrations",          label: "التكاملات والـ API",    icon: Plug },
      { href: "/website-builder",       label: "منشئ المواقع",          icon: LayoutIcon,  feature: "website" },
      { href: "/office-management",     label: "إدارة المكتب الرقمي",   icon: Globe,       feature: "website" },
      { href: "/support",               label: "الدعم الفني",           icon: LifeBuoy },
    ],
  },

  /* ── 9. رأس المال البشري ──────────────────────────────────────────── */
  {
    id: "hr",
    label: "رأس المال البشري",
    icon: Users,
    color: "#F59E0B",
    items: [
      { href: "/hr-enterprise", label: "HR المؤسسي",          icon: Shield },
      { href: "/hr-center",     label: "مركز الموارد البشرية", icon: Award },
      { href: "/hr-systems",    label: "أنظمة HR",             icon: Building2 },
      { href: "/employees",     label: "الموظفون",             icon: UserCog },
      { href: "/attendance",    label: "الحضور والانصراف",     icon: Clock },
      { href: "/leaves",        label: "الإجازات",             icon: CalendarDays },
      { href: "/payroll",       label: "الرواتب",              icon: DollarSign,   permission: "payroll:view" },
      { href: "/warnings",      label: "التحقيقات والإنذارات", icon: AlertTriangle },
      { href: "/org-structure", label: "الهيكل الوظيفي",      icon: Network },
    ],
  },

  /* ── 10. التحليلات والحوكمة ───────────────────────────────────────── */
  {
    id: "analytics",
    label: "التحليلات والحوكمة",
    icon: BarChart3,
    color: "#EC4899",
    items: [
      { href: "/analytics",          label: "تحليلات الأداء",     icon: BarChart3,    feature: "advancedReports" },
      { href: "/risk-management",    label: "إدارة المخاطر",      icon: AlertTriangle, feature: "advancedReports" },
      { href: "/activity-stream",    label: "نبض النظام",          icon: Activity },
      { href: "/audit-logs",         label: "سجل المراقبة",        icon: FileText },
      { href: "/compliance",         label: "الامتثال والحوكمة",   icon: Shield },
      { href: "/login-tracking",     label: "تتبع الدخول",         icon: Lock },
      { href: "/team",               label: "الصلاحيات والأدوار",  icon: Shield },
      { href: "/users",              label: "المستخدمون",          icon: Users,        permission: "users:view" },
      { href: "/office-settings",    label: "إعدادات المكتب",      icon: Building2,    permission: "settings:view" },
      { href: "/theme-builder",      label: "هوية المكتب البصرية", icon: Palette },
      { href: "/backup",             label: "النسخ الاحتياطي",     icon: Database },
      { href: "/branches",           label: "الفروع",              icon: GitBranch },
    ],
  },

  /* ── 11. Justice Legal World Model ───────────────────────────────── */
  {
    id: "jlwm",
    label: "Justice Legal World Model",
    icon: BrainCircuit,
    color: "#6366F1",
    items: [
      { href: "/jlwm",                         label: "لوحة JLWM",                icon: Brain },
      { href: "/jlwm/world-state",             label: "حالة العالم القانوني",     icon: Globe },
      { href: "/jlwm/memory-graph",            label: "الذاكرة القانونية",        icon: Network },
      { href: "/jlwm/command",                 label: "مركز القيادة",             icon: Cpu },
      { href: "/jlwm/predictions",             label: "محرك التنبؤ",              icon: Sparkles },
      { href: "/jlwm/future-explorer",         label: "مستكشف المستقبل",          icon: TrendingUp },
      { href: "/jlwm/simulation",              label: "محاكاة السيناريوهات",      icon: Zap },
      { href: "/jlwm/litigation-intelligence", label: "ذكاء المرافعة",            icon: Shield },
      { href: "/jlwm/prediction-accuracy",     label: "مركز دقة التنبؤ",          icon: Target },
      { href: "/jlwm/executive-intelligence",  label: "الذكاء التنفيذي",          icon: Crown },
      { href: "/jlwm/legal-coo",               label: "المدير التشغيلي الذكي",    icon: BrainCog },
      { href: "/jlwm/reliability",             label: "الموثوقية والتحقق",        icon: ShieldCheck },
      { href: "/jlwm/enterprise",              label: "التقرير المؤسسي الشامل",   icon: Award },
    ],
  },

  /* ── 12. إدارة المنصة (Super Admin Only) ─────────────────────────── */
  {
    id: "superadmin",
    label: "إدارة المنصة",
    icon: Shield,
    color: "#EF4444",
    superAdminOnly: true,
    items: [
      { href: "/super-admin",       label: "لوحة المشرف العام",       icon: Shield },
      { href: "/studio",            label: "مركز الاستوديو",           icon: Cpu },
      { href: "/ai-command-center", label: "مركز قيادة الذكاء",        icon: Bot },
      { href: "/engineering-center",label: "مركز الهندسة",             icon: Briefcase },
      { href: "/monitoring",        label: "مركز المراقبة",            icon: Activity },
      { href: "/prevention",        label: "منع الانهيار",              icon: Shield },
      { href: "/alerts",            label: "التنبيهات الذكية",         icon: Bell },
      { href: "/financial-engine",  label: "المحرك المالي",             icon: DollarSign },
      { href: "/finance-dashboard", label: "التقارير المالية",          icon: BarChart2 },
      { href: "/isolation",         label: "عزل المستأجرين",           icon: Lock },
      { href: "/hardening",         label: "قفل الإنتاج",              icon: Shield },
      { href: "/zero-trust",        label: "Zero Trust Shield",         icon: ShieldCheck },
      { href: "/production-launch", label: "مركز إطلاق الإنتاج",       icon: Rocket },
      { href: "/launch-gate",       label: "بوابة الانطلاقة الذكية",   icon: Sparkles },
      { href: "/legal-os",          label: "نظام التشغيل القانوني",    icon: Cpu },
      { href: "/self-healing",      label: "الإصلاح الذاتي",           icon: Activity },
      { href: "/soc",               label: "مركز العمليات الأمنية",    icon: Shield },
      { href: "/audit-center",      label: "مركز التدقيق المؤسسي",     icon: FileText },
    ],
  },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ══════════════════════════════════════════════════════════════════════════
   HOOKS
══════════════════════════════════════════════════════════════════════════ */
function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "true"; } catch { return false; }
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("sidebar_favorites") || "[]"); } catch { return []; }
  });
  const [recents, setRecents] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("sidebar_recents") || "[]"); } catch { return []; }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed(p => { const next = !p; try { localStorage.setItem("sidebar_collapsed", String(next)); } catch {} return next; });
  }, []);

  const toggleFavorite = useCallback((href: string) => {
    setFavorites(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      try { localStorage.setItem("sidebar_favorites", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addRecent = useCallback((href: string) => {
    setRecents(prev => {
      const next = [href, ...prev.filter(h => h !== href)].slice(0, 5);
      try { localStorage.setItem("sidebar_recents", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed, favorites, toggleFavorite, recents, addRecent };
}

/* ══════════════════════════════════════════════════════════════════════════
   NAV ITEM LINK
══════════════════════════════════════════════════════════════════════════ */
function NavItemLink({
  item, isActive, onClick, badgeCount, accentColor, collapsed: sidebarCollapsed,
  isFavorite, onToggleFavorite, showFavoriteBtn,
}: {
  item: NavItem; isActive: boolean; onClick?: () => void; badgeCount?: number;
  accentColor?: string; collapsed?: boolean; isFavorite?: boolean;
  onToggleFavorite?: () => void; showFavoriteBtn?: boolean;
}) {
  const { hasFeature, isLoaded } = useOfficePlan();
  const { hasPermission, isLoaded: permLoaded } = usePermissions();
  const isLocked = isLoaded && item.feature ? !hasFeature(item.feature) : false;

  if (permLoaded && item.permission && !hasPermission(item.permission)) return null;

  const baseClass = [
    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium",
    "transition-all duration-150 w-full min-h-[38px]",
    sidebarCollapsed ? "justify-center px-0" : "",
  ].join(" ");

  const content = (
    <>
      <item.icon
        className="h-4 w-4 flex-shrink-0 transition-colors"
        style={isActive && accentColor ? { color: accentColor } : {}}
      />
      {!sidebarCollapsed && (
        <>
          <span className="truncate flex-1 text-right leading-tight">{item.label}</span>
          {/* Tag */}
          {item.tag && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none ${
              item.tag === "new" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" :
              item.tag === "beta" ? "bg-blue-500/15 text-blue-600 border-blue-500/20" :
              "bg-purple-500/15 text-purple-600 border-purple-500/20"
            }`}>
              {item.tag === "new" ? "جديد" : item.tag === "beta" ? "تجريبي" : "PRO"}
            </span>
          )}
          {/* Badge */}
          {badgeCount != null && badgeCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none flex-shrink-0">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
          {/* Lock */}
          {isLocked && <Lock className="h-3 w-3 flex-shrink-0 opacity-40" />}
          {/* Favorite toggle */}
          {showFavoriteBtn && !isLocked && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite?.(); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-amber-400"
              title={isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
            >
              {isFavorite ? <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> : <Star className="h-3 w-3" />}
            </button>
          )}
        </>
      )}
      {sidebarCollapsed && badgeCount != null && badgeCount > 0 && (
        <span className="absolute top-0.5 left-0.5 h-2 w-2 bg-red-500 rounded-full" />
      )}
    </>
  );

  if (isLocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/billing"
            className={`${baseClass} text-sidebar-foreground/30 cursor-default`}
            onClick={onClick}>
            {content}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-48">
          {sidebarCollapsed ? item.label + " — " : ""}هذه الميزة غير مفعّلة في باقتك الحالية
        </TooltipContent>
      </Tooltip>
    );
  }

  const linkEl = (
    <Link
      href={item.href}
      className={`${baseClass} ${
        isActive
          ? "text-primary font-semibold"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
      }`}
      style={isActive && accentColor
        ? { backgroundColor: `${accentColor}15`, borderRight: `2px solid ${accentColor}`, color: accentColor }
        : isActive ? { backgroundColor: "hsl(var(--primary)/0.08)", borderRight: "2px solid hsl(var(--primary))" } : {}}
      onClick={onClick}
    >
      {content}
    </Link>
  );

  if (sidebarCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="left" className="text-xs">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return linkEl;
}

/* ══════════════════════════════════════════════════════════════════════════
   NAV SECTION (collapsible group)
══════════════════════════════════════════════════════════════════════════ */
function NavSectionBlock({
  section, location, badges, onItemClick, isSuperAdmin: sa, collapsed: sidebarCollapsed,
  favorites, onToggleFavorite, searchQuery,
}: {
  section: NavSection; location: string; badges: Record<string, number>;
  onItemClick?: () => void; isSuperAdmin: boolean; collapsed: boolean;
  favorites: string[]; onToggleFavorite: (href: string) => void; searchQuery: string;
}) {
  const { hasFeature, isLoaded: planLoaded } = useOfficePlan();

  const visibleItems = useMemo(() =>
    section.items.filter(item => !item.superAdminOnly || sa),
    [section.items, sa]
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery) return visibleItems;
    return visibleItems.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [visibleItems, searchQuery]);

  const isAnyActive = visibleItems.some(item =>
    location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href))
  );

  const [open, setOpen] = useState(isAnyActive);

  useEffect(() => {
    if (isAnyActive && !searchQuery) setOpen(true);
  }, [isAnyActive]);

  useEffect(() => {
    if (searchQuery && filteredItems.length > 0) setOpen(true);
  }, [searchQuery, filteredItems.length]);

  if (filteredItems.length === 0 && searchQuery) return null;

  const isBankruptcyLocked = section.standalone && section.lockFeature
    ? planLoaded && !hasFeature(section.lockFeature)
    : false;

  const SectionIcon = section.icon;

  if (sidebarCollapsed) {
    return (
      <div className="mb-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 ${
                isAnyActive ? "opacity-100" : "opacity-50 hover:opacity-80"
              }`}
              style={{
                backgroundColor: isAnyActive ? `${section.color}20` : "transparent",
                boxShadow: isAnyActive ? `0 0 0 1px ${section.color}30` : "none",
              }}
              onClick={() => setOpen(p => !p)}
            >
              <SectionIcon className="h-4.5 w-4.5" style={{ color: isAnyActive ? section.color : "currentColor" }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">{section.label}</TooltipContent>
        </Tooltip>
        {open && !sidebarCollapsed && null}
      </div>
    );
  }

  return (
    <div className="mb-0.5">
      {/* Section header */}
      <button
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-semibold tracking-wide uppercase transition-all duration-150 min-h-[36px] ${
          isAnyActive
            ? "text-sidebar-foreground bg-sidebar-accent/40"
            : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/25"
        }`}
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            backgroundColor: isAnyActive ? `${section.color}25` : "transparent",
            boxShadow: isAnyActive ? `0 0 0 1px ${section.color}35` : "none",
          }}
        >
          <SectionIcon className="h-3 w-3" style={{ color: isAnyActive ? section.color : "currentColor" }} />
        </div>
        <span className="flex-1 text-right truncate normal-case text-[11.5px]">{section.label}</span>
        {/* Standalone badge */}
        {section.standalone && (
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border leading-none flex-shrink-0 ${
            isBankruptcyLocked
              ? "bg-red-500/10 text-red-500 border-red-500/20"
              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          }`}>
            {isBankruptcyLocked ? "🔒 مقفل" : "✓ نشط"}
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: isAnyActive ? section.color : "currentColor" }}
        />
      </button>

      {/* Items */}
      {open && (
        <div
          className="mt-0.5 mb-0.5 space-y-0.5 pe-1.5 ms-5 border-r border-dashed"
          style={{ borderColor: `${section.color}25` }}
        >
          {filteredItems.map((item) => {
            const isActive = location === item.href ||
              (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <NavItemLink
                key={item.href}
                item={item}
                isActive={isActive}
                onClick={onItemClick}
                badgeCount={item.badge ? badges[item.badge] : undefined}
                accentColor={section.color}
                isFavorite={favorites.includes(item.href)}
                onToggleFavorite={() => onToggleFavorite(item.href)}
                showFavoriteBtn
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR SEARCH + QUICK ACCESS
══════════════════════════════════════════════════════════════════════════ */
function SidebarSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-3 py-2">
      <div className="relative">
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/35 pointer-events-none" />
        <input
          type="text"
          placeholder="ابحث في القائمة..."
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-sidebar-accent/40 border border-sidebar-border/50 rounded-lg py-1.5 pr-8 pl-3 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/35 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
        />
        {value && (
          <button onClick={() => onChange("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground/70">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function QuickAccessBar({
  favorites, recents, allItems, location, onItemClick, badges,
}: {
  favorites: string[]; recents: string[]; allItems: NavItem[];
  location: string; onItemClick?: () => void; badges: Record<string, number>;
}) {
  const [tab, setTab] = useState<"fav" | "recent">("fav");
  const favItems = allItems.filter(item => favorites.includes(item.href));
  const recentItems = allItems.filter(item => recents.includes(item.href))
    .sort((a, b) => recents.indexOf(a.href) - recents.indexOf(b.href));

  const items = tab === "fav" ? favItems : recentItems;
  if (favItems.length === 0 && recentItems.length === 0) return null;

  return (
    <div className="mx-3 mb-2 rounded-xl border border-sidebar-border/40 bg-sidebar-accent/20 overflow-hidden">
      <div className="flex border-b border-sidebar-border/30">
        <button
          onClick={() => setTab("fav")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-semibold transition-colors ${
            tab === "fav" ? "text-amber-500 bg-amber-500/10" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
          }`}
        >
          <Star className="h-3 w-3" /> المفضلة {favItems.length > 0 && `(${favItems.length})`}
        </button>
        <button
          onClick={() => setTab("recent")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-semibold transition-colors ${
            tab === "recent" ? "text-blue-500 bg-blue-500/10" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
          }`}
        >
          <History className="h-3 w-3" /> الأخيرة
        </button>
      </div>
      <div className="p-1 space-y-0.5">
        {items.length === 0 ? (
          <p className="text-center text-[10px] text-sidebar-foreground/30 py-2">
            {tab === "fav" ? "لا توجد عناصر مفضلة" : "لا يوجد سجل زيارات"}
          </p>
        ) : items.map(item => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          const badgeCount = item.badge ? badges[item.badge] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? "text-primary bg-primary/8" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              }`}
            >
              <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate flex-1">{item.label}</span>
              {badgeCount != null && badgeCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">{badgeCount > 99 ? "99+" : badgeCount}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR FOOTER CARD
══════════════════════════════════════════════════════════════════════════ */
type UserStatus = "online" | "busy" | "away";

function SidebarFooterCard({
  user, displayName, branding, plan, collapsed, onSignOut,
}: {
  user: any; displayName: string; branding: any; plan: any;
  collapsed: boolean; onSignOut: () => void;
}) {
  const [status, setStatus] = useState<UserStatus>(() => {
    try { return (localStorage.getItem("user_status") as UserStatus) || "online"; } catch { return "online"; }
  });
  const [showMenu, setShowMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const statusConfig = {
    online: { label: "متصل",    color: "#22C55E", icon: CircleDot },
    busy:   { label: "مشغول",   color: "#F59E0B", icon: Minus },
    away:   { label: "غائب",    color: "#94A3B8", icon: Circle },
  };

  const setUserStatus = (s: UserStatus) => {
    setStatus(s);
    try { localStorage.setItem("user_status", s); } catch {}
  };

  const StatusIcon = statusConfig[status].icon;
  const initials = displayName.slice(0, 2);

  if (collapsed) {
    return (
      <div className="border-t border-sidebar-border p-2 flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative cursor-pointer" onClick={() => setShowMenu(p => !p)}>
              <Avatar className="h-9 w-9 border-2 border-sidebar-border">
                {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
              <span
                className="absolute bottom-0 left-0 h-3 w-3 rounded-full border-2 border-sidebar"
                style={{ backgroundColor: statusConfig[status].color }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">{displayName} — {statusConfig[status].label}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border p-2 shrink-0" ref={ref}>
      {/* Office info strip */}
      <div className="flex items-center gap-2 px-2 py-1.5 mb-1.5 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/30">
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt="" className="h-6 w-6 object-contain rounded-md flex-shrink-0" />
        ) : (
          <div className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${branding?.primaryColor || "#2563EB"}, ${branding?.primaryColor || "#2563EB"}cc)` }}>
            {(branding?.officeName || "م")[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-sidebar-foreground truncate leading-tight">
            {branding?.officeName || "مكتب المحاماة"}
          </p>
          <p className="text-[9px] text-sidebar-foreground/45 leading-tight truncate">
            {plan?.planName || "الباقة الأساسية"}
          </p>
        </div>
        <div className={`flex-shrink-0 h-5 px-1.5 rounded-full flex items-center text-[9px] font-bold ${
          plan?.isTrial ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"
        }`}>
          {plan?.isTrial ? "تجريبي" : "نشط"}
        </div>
      </div>

      {/* User card */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(p => !p)}
          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-sidebar-accent/50 transition-all duration-150 group"
        >
          <div className="relative flex-shrink-0">
            <Avatar className="h-8 w-8 border border-sidebar-border">
              {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <span
              className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar transition-colors"
              style={{ backgroundColor: statusConfig[status].color }}
            />
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">{displayName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <StatusIcon className="h-2.5 w-2.5 flex-shrink-0" style={{ color: statusConfig[status].color }} />
              <span className="text-[10px] text-sidebar-foreground/45">{statusConfig[status].label}</span>
            </div>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-sidebar-foreground/30 transition-transform duration-200 ${showMenu ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
            {/* Status options */}
            <div className="px-3 py-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">الحالة</p>
              <div className="grid grid-cols-3 gap-1">
                {(["online", "busy", "away"] as UserStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setUserStatus(s)}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      status === s ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusConfig[s].color }} />
                    {statusConfig[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border/40 my-1" />
            {/* Actions */}
            {[
              { href: "/profile", label: "الملف الشخصي", icon: UserCheck },
              { href: "/office-settings", label: "الإعدادات", icon: Settings },
              { href: "/support", label: "المساعدة", icon: HelpCircle },
            ].map(action => (
              <Link key={action.href} href={action.href}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                onClick={() => setShowMenu(false)}>
                <action.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {action.label}
              </Link>
            ))}
            <div className="border-t border-border/40 my-1" />
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/8 transition-colors"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              تسجيل الخروج
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TRIAL BANNER
══════════════════════════════════════════════════════════════════════════ */
function TrialBanner() {
  const { isTrial, trialDaysLeft } = useOfficePlan();
  if (!isTrial) return null;
  const days = trialDaysLeft ?? 30;
  const critical = days <= 2;
  const urgent   = days <= 7;
  if (critical) return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium z-50 shrink-0 bg-red-600 text-white">
      <div className="flex items-center gap-2">
        <span className="animate-pulse text-base">⚠️</span>
        <span>
          تنتهي تجربتك خلال{" "}
          <strong className="font-black">
            {days === 0 ? "أقل من 24 ساعة" : `${days} ${days === 1 ? "يوم" : "أيام"}`}
          </strong>
          {" "}— حوّل مكتبك الآن
        </span>
      </div>
      <a href="/upgrade" className="shrink-0 px-3 py-1 rounded-full text-[10px] font-black border border-white/50 hover:bg-white/20 transition-colors whitespace-nowrap">
        اشترك الآن 🔥
      </a>
    </div>
  );
  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium z-50 shrink-0 ${urgent ? "bg-amber-50 border-b border-amber-200 text-amber-800" : "bg-emerald-50 border-b border-emerald-100 text-emerald-700"}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{urgent ? "⏳" : "🎁"}</span>
        <span>
          {urgent ? "تجربتك المجانية تقترب من نهايتها — " : "فترة تجريبية مجانية — جميع الميزات مفعّلة "}
          {trialDaysLeft != null && (
            <span className={`font-bold ${urgent ? "text-amber-900" : "text-blue-800"}`}>
              {urgent && "تبقى "}{trialDaysLeft} {trialDaysLeft === 1 ? "يوم" : "أيام"}{urgent && " فقط"}
            </span>
          )}
        </span>
      </div>
      <a href="/upgrade" className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors whitespace-nowrap ${urgent ? "border-amber-400 text-amber-800 hover:bg-amber-100 bg-amber-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-100"}`}>
        {urgent ? "اشترك الآن ←" : "عرض الخطط"}
      </a>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR CONTENT (shared between desktop/mobile)
══════════════════════════════════════════════════════════════════════════ */
function SidebarContent({
  location, badges, isSuperAdmin: sa, onItemClick, collapsed,
  favorites, onToggleFavorite, recents,
}: {
  location: string; badges: Record<string, number>;
  isSuperAdmin: boolean; onItemClick?: () => void; collapsed: boolean;
  favorites: string[]; onToggleFavorite: (href: string) => void; recents: string[];
}) {
  const [search, setSearch] = useState("");
  const visibleSections = NAV_SECTIONS.filter(s => !s.superAdminOnly || sa);

  const allItems = useMemo(() =>
    visibleSections.flatMap(s => s.items.filter(item => !item.superAdminOnly || sa)),
    [visibleSections, sa]
  );

  return (
    <>
      {/* Search */}
      {!collapsed && (
        <SidebarSearch value={search} onChange={setSearch} />
      )}

      {/* Quick Access (favorites + recents) */}
      {!collapsed && !search && (
        <QuickAccessBar
          favorites={favorites}
          recents={recents}
          allItems={allItems}
          location={location}
          onItemClick={onItemClick}
          badges={badges}
        />
      )}

      {/* Sections */}
      <nav className={`flex-1 py-1 ${collapsed ? "px-1 space-y-1" : "px-2 space-y-0.5"}`}>
        {visibleSections.map(section => (
          <NavSectionBlock
            key={section.id}
            section={section}
            location={location}
            badges={badges}
            onItemClick={onItemClick}
            isSuperAdmin={sa}
            collapsed={collapsed}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            searchQuery={search}
          />
        ))}
      </nav>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN LAYOUT
══════════════════════════════════════════════════════════════════════════ */
export function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { t, i18n } = useTranslation();
  const { data: branding } = useBranding();
  const { planName, isTrial } = useOfficePlan();

  useEffect(() => {
    document.documentElement.dir  = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const displayName = isLoaded && user
    ? user.fullName || user.emailAddresses[0]?.emailAddress?.split("@")[0] || "المدير"
    : "المدير";

  const isSuperAdmin = useIsSuperAdmin();
  useLoginTracker();

  const { collapsed, toggleCollapsed, favorites, toggleFavorite, recents, addRecent } = useSidebarState();

  /* Track recent pages */
  useEffect(() => {
    if (location && location !== "/") addRecent(location);
  }, [location]);

  /* Onboarding gate */
  const { data: onboardingState } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetch(`${basePath}/api/onboarding/state`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    enabled: isLoaded && !!user,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (isLoaded && user && onboardingState && !onboardingState.completed && location !== "/onboarding") {
      navigate("/onboarding");
    }
  }, [isLoaded, user, onboardingState?.completed, location]);

  /* Reminders badge */
  const { data: remindersData } = useQuery({
    queryKey: ["reminders-count"],
    queryFn: () => fetch(`${basePath}/api/reminders/count`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const pendingRemindersCount: number = remindersData?.count ?? 0;

  const badges: Record<string, number> = {
    reminders: pendingRemindersCount,
  };

  useEffect(() => { setIsMobileMenuOpen(false); }, [location]);
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  const primary = branding?.primaryColor || "#2563EB";
  const officeName = branding?.officeName || "عدالة AI";

  const handleSignOut = () => signOut({ redirectUrl: basePath || "/" });

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out ${
          collapsed ? "w-[60px]" : "w-64"
        }`}
        style={{ flexShrink: 0 }}
      >
        {/* Header */}
        <div className={`flex h-16 items-center border-b border-sidebar-border shrink-0 ${collapsed ? "justify-center px-2" : "justify-between px-4 gap-3"}`}
          style={{ background: "hsl(var(--sidebar))" }}>
          {!collapsed && (
            <>
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt={officeName}
                  className="h-9 w-9 object-contain rounded-xl bg-white/10 p-0.5 flex-shrink-0" />
              ) : (
                <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
                  {officeName[0]}
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate leading-tight">{officeName}</span>
                <span className="text-[10px] text-sidebar-foreground/45 truncate leading-tight">{branding?.tagline || "منصة إدارة قانونية"}</span>
              </div>
            </>
          )}

          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-150 ${collapsed ? "" : ""}`}
            title={collapsed ? "توسيع القائمة" : "طي القائمة"}
          >
            {collapsed
              ? <ChevronLeft className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto scrollbar-thin overflow-x-hidden">
          <SidebarContent
            location={location}
            badges={badges}
            isSuperAdmin={isSuperAdmin}
            collapsed={collapsed}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            recents={recents}
          />
        </div>

        {/* Footer */}
        <SidebarFooterCard
          user={user}
          displayName={displayName}
          branding={branding}
          plan={{ planName, isTrial }}
          collapsed={collapsed}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* ── Mobile Sidebar ──────────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside
            className="absolute right-0 top-0 bottom-0 w-[300px] max-w-[90vw] bg-sidebar border-l border-sidebar-border flex flex-col shadow-2xl"
            style={{ animation: "slideInFromRight 0.25s cubic-bezier(0.16,1,0.3,1)" }}
          >
            {/* Mobile header */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {branding?.logoUrl ? (
                  <img src={branding.logoUrl} alt="" className="h-8 w-8 object-contain rounded-xl flex-shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                    style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
                    {officeName[0]}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-sidebar-foreground truncate leading-tight">{officeName}</span>
                  <span className="text-[11px] text-sidebar-foreground/45 truncate leading-tight">منصة إدارة قانونية</span>
                </div>
              </div>
              <Button variant="ghost" size="icon"
                className="h-9 w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg shrink-0"
                onClick={() => setIsMobileMenuOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <SidebarContent
                location={location}
                badges={badges}
                isSuperAdmin={isSuperAdmin}
                onItemClick={() => setIsMobileMenuOpen(false)}
                collapsed={false}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                recents={recents}
              />
            </div>

            <SidebarFooterCard
              user={user}
              displayName={displayName}
              branding={branding}
              plan={{ planName, isTrial }}
              collapsed={false}
              onSignOut={handleSignOut}
            />
          </aside>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TrialBanner />

        {/* Top Header */}
        <header className="flex h-14 md:h-16 items-center justify-between border-b bg-card px-3 sm:px-5 gap-2 shrink-0">

          {/* Mobile: Hamburger */}
          <div className="flex items-center gap-2 md:hidden shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
                <Scale className="h-4 w-4" />
              </div>
              <span className="text-base font-bold text-foreground">{officeName.split(" ")[0]}</span>
            </div>
          </div>

          {/* Desktop: ⌘K search bar */}
          <div className="hidden md:flex flex-1 items-center max-w-sm">
            <button
              onClick={() => (window as any).__openCommandBar?.()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-muted/40 hover:bg-muted/70 hover:border-border/80 transition-all text-sm text-muted-foreground group"
            >
              <Search className="h-3.5 w-3.5 shrink-0 group-hover:text-foreground transition-colors" />
              <span className="flex-1 text-right text-[13px]">ابحث أو اكتب أمراً...</span>
              <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono border border-border/50 rounded px-1.5 py-0.5 bg-background/70 shrink-0">
                <span className="text-[11px]">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 mr-auto shrink-0">
            <button
              className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
              onClick={() => (window as any).__openCommandBar?.()}
            >
              <Search className="h-4.5 w-4.5" />
            </button>
            <LanguageSwitcher />
            <NotificationsPanel />
            <AccountMenu />
            <button
              onClick={handleSignOut}
              title="تسجيل الخروج"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-300 transition-all duration-150 me-1 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Floating AI Copilot */}
      <FloatingCopilot />
      <CommandBar />
    </div>
  );
}
