import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Scale, FileText, Bot, Users, CreditCard, Menu, Search,
  Sparkles, LogOut, Zap, UserCircle, BookOpen, Handshake,
  AlertTriangle, BarChart3, Shield, ShieldCheck, UserCog, Clock, CalendarDays, DollarSign,
  Building2, Gavel, MessageCircle, Globe, Receipt, Mail, ShoppingBag, Crown,
  BrainCircuit, Lock, Database, TrendingUp, TrendingDown, ArrowRightLeft,
  Landmark, Wallet, BarChart2, Cpu, HardDrive, Bell, Mail as MailIcon, MessageSquare,
  FileSignature, Palette, ClipboardList, LifeBuoy, Network, Award, Activity, Send,
  ChevronDown, Briefcase, X, BellRing, GitBranch, Plug, Rocket, Brain,
  Layout as LayoutIcon, FolderOpen, Target, BrainCog, Settings2,
  ChevronLeft, ChevronRight, Star, History,
  CircleDot, Circle, Minus, Settings, HelpCircle,
  CheckCircle2, UserCheck, MapPin, RefreshCw, Building,
  Layers, ListTodo, FileSearch, PenTool, FlaskConical, Workflow,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser, useClerk } from "@clerk/react";
import { useLoginTracker } from "@/hooks/useLoginTracker";
import { useIsSuperAdmin } from "@/hooks/use-role";
import { usePermissions } from "@/hooks/use-permissions";
import { FloatingCopilot } from "@/components/floating-copilot";
import { CommandBar } from "@/components/command-bar";

/* ══════════════════════════════════════════════════════════════════════════
   TYPES
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

interface NavGroup {
  groupLabel: string;
  groupIcon?: React.ComponentType<any>;
  items: NavItem[];
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  items?: NavItem[];
  groups?: NavGroup[];
  superAdminOnly?: boolean;
  standalone?: boolean;
  lockFeature?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION DATA
══════════════════════════════════════════════════════════════════════════ */
const NAV_SECTIONS: NavSection[] = [

  /* ── 1. لوحة التحكم ────────────────────────────────────────────── */
  {
    id: "dashboard",
    label: "لوحة التحكم",
    icon: LayoutDashboard,
    color: "#2563EB",
    items: [
      { href: "/dashboard",           label: "الرئيسية",              icon: LayoutDashboard },
      { href: "/firm-admin",          label: "لوحة مدير المكتب",      icon: Crown },
      { href: "/executive-dashboard", label: "لوحة القيادة التنفيذية", icon: BarChart3, superAdminOnly: true },
    ],
  },

  /* ── 2. إدارة القضايا ───────────────────────────────────────────── */
  {
    id: "cases",
    label: "إدارة القضايا",
    icon: Scale,
    color: "#6366F1",
    items: [
      { href: "/cases",             label: "القضايا",         icon: Scale },
      { href: "/hearings-calendar", label: "الجلسات",         icon: Gavel },
      { href: "/calendar",          label: "التقويم",         icon: CalendarDays, feature: "calendar" },
      { href: "/tasks",             label: "المهام",          icon: ClipboardList },
      { href: "/reminders",         label: "التذكيرات",       icon: Bell, badge: "reminders" },
      { href: "/messages",          label: "المراسلات",       icon: MessageCircle },
      { href: "/document-center",   label: "الأرشيف القضائي", icon: FolderOpen },
    ],
  },

  /* ── 3. إدارة العملاء ───────────────────────────────────────────── */
  {
    id: "crm",
    label: "إدارة العملاء",
    icon: UserCircle,
    color: "#0EA5E9",
    items: [
      { href: "/clients",       label: "العملاء",         icon: UserCircle },
      { href: "/client-portal", label: "بوابة العميل",     icon: Globe,      feature: "clientPortal" },
      { href: "/mediators",     label: "الوسطاء والوكلاء", icon: Handshake },
      { href: "/marketplace",   label: "سوق الخدمات",      icon: ShoppingBag, feature: "serviceStore" },
    ],
  },

  /* ── 4. العقود والمستندات ──────────────────────────────────────── */
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

  /* ── 5. العمليات المالية (مجموعات داخلية) ──────────────────────── */
  {
    id: "finance",
    label: "العمليات المالية",
    icon: DollarSign,
    color: "#10B981",
    groups: [
      {
        groupLabel: "الإيرادات",
        groupIcon: TrendingUp,
        items: [
          { href: "/invoices",      label: "الفواتير",          icon: Receipt },
          { href: "/payment-center",label: "المدفوعات",         icon: Landmark },
          { href: "/collections",   label: "التحصيل",           icon: TrendingUp },
          { href: "/revenues",      label: "الإيرادات",         icon: TrendingUp,   permission: "financial:view" },
        ],
      },
      {
        groupLabel: "المحاسبة",
        groupIcon: BarChart2,
        items: [
          { href: "/bank-accounts",    label: "الحسابات البنكية",  icon: Landmark,       permission: "financial:view" },
          { href: "/expenses",         label: "المصروفات",         icon: TrendingDown,   permission: "financial:view" },
          { href: "/advances",         label: "السُّلف",           icon: Wallet,         permission: "financial:view" },
          { href: "/tax-settings",     label: "الضرائب",           icon: Settings2,      permission: "financial:view" },
          { href: "/enterprise-finance",label: "المحاسبة ERP",     icon: Scale },
        ],
      },
      {
        groupLabel: "التقارير",
        groupIcon: BarChart3,
        items: [
          { href: "/financial-reports",    label: "التقارير المالية",  icon: BarChart2 },
          { href: "/financial-statements", label: "القوائم المالية",   icon: Scale },
          { href: "/cashflow",             label: "التدفقات النقدية",  icon: ArrowRightLeft, permission: "financial:view" },
          { href: "/financial-intelligence",label: "الذكاء المالي",    icon: BrainCircuit },
          { href: "/financial-core",       label: "المحرك المالي",     icon: BarChart3 },
          { href: "/finance",              label: "مركز المالية",      icon: DollarSign },
          { href: "/billing",              label: "الاشتراك والباقات", icon: CreditCard },
        ],
      },
    ],
  },

  /* ── 6. مركز الذكاء الاصطناعي (مجموعات داخلية) ────────────────── */
  {
    id: "ai",
    label: "مركز الذكاء الاصطناعي",
    icon: Sparkles,
    color: "#7C3AED",
    groups: [
      {
        groupLabel: "لوحة الذكاء",
        groupIcon: BrainCircuit,
        items: [
          { href: "/ai-hub",    label: "مركز الذكاء",           icon: BrainCircuit, feature: "ai" },
          { href: "/ai-coo",    label: "المدير التنفيذي الذكي", icon: Brain,         feature: "ai" },
          { href: "/ai-copilot",label: "المساعد القانوني",       icon: Bot,           feature: "ai", tag: "new" },
        ],
      },
      {
        groupLabel: "الوكلاء الذكيون",
        groupIcon: Workflow,
        items: [
          { href: "/legal-ai",            label: "كتابة المذكرات",       icon: PenTool,   feature: "ai" },
          { href: "/judge-prep",          label: "محاكاة المرافعة",      icon: Gavel,     feature: "ai" },
          { href: "/ai-workflow-builder", label: "بناء سير العمل",       icon: GitBranch, superAdminOnly: true },
        ],
      },
      {
        groupLabel: "الأتمتة والنماذج",
        groupIcon: FlaskConical,
        items: [
          { href: "/financial-intelligence", label: "الذكاء المالي",    icon: TrendingUp },
        ],
      },
    ],
  },

  /* ── 7. عدالة إفلاس (Standalone) ──────────────────────────────── */
  {
    id: "bankruptcy",
    label: "عدالة إفلاس",
    icon: Landmark,
    color: "#DC2626",
    standalone: true,
    lockFeature: "bankruptcy",
    items: [
      { href: "/bankruptcy",           label: "لوحة الإفلاس",   icon: Landmark },
      { href: "/bankruptcy/cases",     label: "قضايا الإفلاس",  icon: Scale },
      { href: "/bankruptcy/creditors", label: "الدائنون",       icon: Users },
      { href: "/bankruptcy/assets",    label: "الأصول والتصفية", icon: Database },
      { href: "/bankruptcy/reports",   label: "التقارير",        icon: FileText },
    ],
  },

  /* ── 8. مركز الاتصالات ─────────────────────────────────────────── */
  {
    id: "comms",
    label: "مركز الاتصالات",
    icon: MessageCircle,
    color: "#3B82F6",
    items: [
      { href: "/email-notifications",   label: "البريد الإلكتروني",  icon: MailIcon },
      { href: "/whatsapp-settings",     label: "واتساب",             icon: MessageSquare },
      { href: "/telegram-settings",     label: "تيليجرام",           icon: Send },
      { href: "/notification-settings", label: "الإشعارات",          icon: BellRing },
      { href: "/integrations",          label: "التكاملات والـ API",  icon: Plug },
      { href: "/website-builder",       label: "منشئ المواقع",        icon: LayoutIcon,  feature: "website" },
      { href: "/office-management",     label: "إدارة المكتب الرقمي", icon: Globe,       feature: "website" },
      { href: "/support",               label: "الدعم الفني",         icon: LifeBuoy },
    ],
  },

  /* ── 9. رأس المال البشري ────────────────────────────────────────── */
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
      { href: "/payroll",       label: "الرواتب",              icon: DollarSign, permission: "payroll:view" },
      { href: "/warnings",      label: "التحقيقات والإنذارات", icon: AlertTriangle },
      { href: "/org-structure", label: "الهيكل الوظيفي",      icon: Network },
    ],
  },

  /* ── 10. التحليلات والحوكمة ─────────────────────────────────────── */
  {
    id: "analytics",
    label: "التحليلات والحوكمة",
    icon: BarChart3,
    color: "#EC4899",
    items: [
      { href: "/analytics",       label: "تحليلات الأداء",     icon: BarChart3,    feature: "advancedReports" },
      { href: "/risk-management", label: "إدارة المخاطر",      icon: AlertTriangle, feature: "advancedReports" },
      { href: "/activity-stream", label: "نبض النظام",          icon: Activity },
      { href: "/audit-logs",      label: "سجل المراقبة",        icon: FileText },
      { href: "/compliance",      label: "الامتثال والحوكمة",   icon: Shield },
      { href: "/login-tracking",  label: "تتبع الدخول",         icon: Lock },
      { href: "/team",            label: "الصلاحيات والأدوار",  icon: Shield },
      { href: "/users",           label: "المستخدمون",          icon: Users,        permission: "users:view" },
      { href: "/office-settings", label: "إعدادات المكتب",      icon: Building2,    permission: "settings:view" },
      { href: "/theme-builder",   label: "هوية المكتب البصرية", icon: Palette },
      { href: "/backup",          label: "النسخ الاحتياطي",     icon: Database },
      { href: "/branches",        label: "الفروع",              icon: GitBranch },
    ],
  },

  /* ── 11. Justice Legal World Model (مجموعات) ────────────────────── */
  {
    id: "jlwm",
    label: "Justice Legal World Model",
    icon: BrainCircuit,
    color: "#6366F1",
    groups: [
      {
        groupLabel: "Dashboard",
        groupIcon: LayoutDashboard,
        items: [
          { href: "/jlwm", label: "لوحة JLWM", icon: Brain },
        ],
      },
      {
        groupLabel: "Intelligence",
        groupIcon: Sparkles,
        items: [
          { href: "/jlwm/world-state",             label: "العالم القانوني",    icon: Globe },
          { href: "/jlwm/memory-graph",            label: "الذاكرة القانونية",  icon: Network },
          { href: "/jlwm/predictions",             label: "محرك التنبؤ",        icon: Sparkles },
          { href: "/jlwm/litigation-intelligence", label: "ذكاء المرافعة",      icon: Shield },
          { href: "/jlwm/future-explorer",         label: "مستكشف المستقبل",    icon: TrendingUp },
        ],
      },
      {
        groupLabel: "Command Center",
        groupIcon: Cpu,
        items: [
          { href: "/jlwm/command",                label: "مركز القيادة",         icon: Cpu },
          { href: "/jlwm/executive-intelligence", label: "الذكاء التنفيذي",      icon: Crown },
          { href: "/jlwm/legal-coo",              label: "المدير التشغيلي",      icon: BrainCog },
          { href: "/jlwm/simulation",             label: "محاكاة السيناريوهات", icon: Zap },
        ],
      },
      {
        groupLabel: "Analytics",
        groupIcon: BarChart3,
        items: [
          { href: "/jlwm/prediction-accuracy", label: "مركز الموثوقية",         icon: Target },
          { href: "/jlwm/reliability",         label: "التحقق والتدقيق",         icon: ShieldCheck },
          { href: "/jlwm/enterprise",          label: "التقرير المؤسسي الشامل", icon: Award },
        ],
      },
    ],
  },

  /* ── 12. إدارة المنصة — SA Only (مجموعات) ─────────────────────── */
  {
    id: "superadmin",
    label: "إدارة المنصة",
    icon: Shield,
    color: "#EF4444",
    superAdminOnly: true,
    groups: [
      {
        groupLabel: "الإدارة العامة",
        groupIcon: Shield,
        items: [
          { href: "/super-admin",        label: "لوحة المشرف العام",    icon: Shield },
          { href: "/executive-dashboard",label: "القيادة التنفيذية",    icon: Crown },
          { href: "/studio",             label: "مركز الاستوديو",        icon: Cpu },
        ],
      },
      {
        groupLabel: "الأمان والصلاحيات",
        groupIcon: ShieldCheck,
        items: [
          { href: "/zero-trust",  label: "Zero Trust Shield",      icon: ShieldCheck },
          { href: "/hardening",   label: "قفل الإنتاج",             icon: Shield },
          { href: "/isolation",   label: "عزل المستأجرين",          icon: Lock },
          { href: "/soc",         label: "مركز العمليات الأمنية",   icon: Shield },
          { href: "/prevention",  label: "منع الانهيار",            icon: AlertTriangle },
        ],
      },
      {
        groupLabel: "البنية التحتية",
        groupIcon: Cpu,
        items: [
          { href: "/legal-os",          label: "نظام التشغيل القانوني", icon: Cpu },
          { href: "/production-launch", label: "مركز إطلاق الإنتاج",   icon: Rocket },
          { href: "/launch-gate",       label: "بوابة الانطلاقة",       icon: Sparkles },
          { href: "/self-healing",      label: "الإصلاح الذاتي",        icon: Activity },
        ],
      },
      {
        groupLabel: "المراقبة والتنبيهات",
        groupIcon: Activity,
        items: [
          { href: "/monitoring", label: "مركز المراقبة",   icon: Activity },
          { href: "/alerts",     label: "التنبيهات الذكية", icon: Bell },
        ],
      },
      {
        groupLabel: "المالية والتقارير",
        groupIcon: DollarSign,
        items: [
          { href: "/financial-engine",  label: "المحرك المالي",    icon: DollarSign },
          { href: "/finance-dashboard", label: "التقارير المالية", icon: BarChart2 },
          { href: "/audit-center",      label: "التدقيق المؤسسي",  icon: FileText },
        ],
      },
      {
        groupLabel: "أدوات المطور",
        groupIcon: Briefcase,
        items: [
          { href: "/engineering-center", label: "مركز الهندسة",      icon: Briefcase },
          { href: "/ai-command-center",  label: "مركز قيادة الذكاء", icon: Bot },
        ],
      },
    ],
  },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR STATE HOOK
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
    setCollapsed(p => {
      const next = !p;
      try { localStorage.setItem("sidebar_collapsed", String(next)); } catch {}
      return next;
    });
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
      const next = [href, ...prev.filter(h => h !== href)].slice(0, 8);
      try { localStorage.setItem("sidebar_recents", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed, favorites, toggleFavorite, recents, addRecent };
}

/* ══════════════════════════════════════════════════════════════════════════
   ALL ITEMS FLAT (for search & favorites)
══════════════════════════════════════════════════════════════════════════ */
function getAllItems(sections: NavSection[], isSuperAdmin: boolean): NavItem[] {
  const items: NavItem[] = [];
  for (const s of sections) {
    if (s.superAdminOnly && !isSuperAdmin) continue;
    if (s.items) {
      for (const item of s.items) {
        if (!item.superAdminOnly || isSuperAdmin) items.push(item);
      }
    }
    if (s.groups) {
      for (const g of s.groups) {
        for (const item of g.items) {
          if (!item.superAdminOnly || isSuperAdmin) items.push(item);
        }
      }
    }
  }
  return items;
}

/* ══════════════════════════════════════════════════════════════════════════
   NAV ITEM LINK
══════════════════════════════════════════════════════════════════════════ */
function NavItemLink({
  item, isActive, onClick, badgeCount, accentColor, sidebarCollapsed,
  isFavorite, onToggleFavorite, showFavBtn,
}: {
  item: NavItem; isActive: boolean; onClick?: () => void; badgeCount?: number;
  accentColor?: string; sidebarCollapsed?: boolean; isFavorite?: boolean;
  onToggleFavorite?: () => void; showFavBtn?: boolean;
}) {
  const { hasFeature, isLoaded } = useOfficePlan();
  const { hasPermission, isLoaded: permLoaded } = usePermissions();
  const isLocked = isLoaded && item.feature ? !hasFeature(item.feature) : false;

  if (permLoaded && item.permission && !hasPermission(item.permission)) return null;

  const base = [
    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium",
    "transition-all duration-150 w-full min-h-[36px]",
    sidebarCollapsed ? "justify-center px-0" : "",
  ].join(" ");

  const inner = (
    <>
      <item.icon className="h-[15px] w-[15px] flex-shrink-0" style={isActive && accentColor ? { color: accentColor } : {}} />
      {!sidebarCollapsed && (
        <>
          <span className="truncate flex-1 text-right leading-tight">{item.label}</span>
          {item.tag && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none ${
              item.tag === "new"  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" :
              item.tag === "beta" ? "bg-blue-500/15 text-blue-600 border-blue-500/20" :
              "bg-purple-500/15 text-purple-600 border-purple-500/20"
            }`}>
              {item.tag === "new" ? "جديد" : item.tag === "beta" ? "تجريبي" : "PRO"}
            </span>
          )}
          {badgeCount != null && badgeCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none flex-shrink-0">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
          {isLocked && <Lock className="h-3 w-3 flex-shrink-0 opacity-35" />}
          {showFavBtn && !isLocked && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite?.(); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-amber-400 flex-shrink-0"
            >
              <Star className={`h-3 w-3 ${isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
            </button>
          )}
        </>
      )}
      {sidebarCollapsed && badgeCount != null && badgeCount > 0 && (
        <span className="absolute top-0.5 left-0.5 h-2 w-2 bg-red-500 rounded-full" />
      )}
    </>
  );

  const linkEl = isLocked ? (
    <Link href="/billing" className={`${base} text-sidebar-foreground/30 cursor-default`} onClick={onClick}>{inner}</Link>
  ) : (
    <Link
      href={item.href}
      className={`${base} ${isActive
        ? "text-primary font-semibold"
        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"}`}
      style={isActive && accentColor
        ? { backgroundColor: `${accentColor}15`, borderRight: `2px solid ${accentColor}`, color: accentColor }
        : isActive ? { backgroundColor: "hsl(var(--primary)/0.08)", borderRight: "2px solid hsl(var(--primary))" } : {}}
      onClick={onClick}
    >
      {inner}
    </Link>
  );

  if (sidebarCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {item.label}{isLocked ? " (غير مفعّل)" : ""}
        </TooltipContent>
      </Tooltip>
    );
  }
  if (isLocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-44">ميزة غير متاحة في باقتك — انقر للترقية</TooltipContent>
      </Tooltip>
    );
  }
  return linkEl;
}

/* ══════════════════════════════════════════════════════════════════════════
   BANKRUPTCY LOCKED CARD
══════════════════════════════════════════════════════════════════════════ */
function BankruptcyLockedCard() {
  return (
    <div className="mx-2 mb-1 rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <Landmark className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-sidebar-foreground leading-tight">عدالة إفلاس</p>
            <p className="text-[10px] text-sidebar-foreground/45 leading-tight">الوحدة المتخصصة</p>
          </div>
          <div className="mr-auto">
            <Lock className="h-3.5 w-3.5 text-red-400/60" />
          </div>
        </div>
        <p className="text-[11px] text-sidebar-foreground/50 mb-2.5 leading-snug">
          الوحدة غير مفعّلة — إدارة قضايا الإفلاس والتصفية بكفاءة عالية
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/billing?tab=plans"
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold transition-colors">
            <Sparkles className="h-3 w-3" />
            ترقية الباقة
          </Link>
          <Link href="/billing?tab=bankruptcy"
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-semibold transition-colors">
            عرض المزايا
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   NAV SECTION BLOCK
══════════════════════════════════════════════════════════════════════════ */
function NavSectionBlock({
  section, location, badges, onItemClick, isSuperAdmin: sa, sidebarCollapsed,
  favorites, onToggleFavorite, searchQuery,
}: {
  section: NavSection; location: string; badges: Record<string, number>;
  onItemClick?: () => void; isSuperAdmin: boolean; sidebarCollapsed: boolean;
  favorites: string[]; onToggleFavorite: (href: string) => void; searchQuery: string;
}) {
  const { hasFeature, isLoaded: planLoaded } = useOfficePlan();

  const flatItems: NavItem[] = useMemo(() => {
    const list: NavItem[] = [];
    if (section.items) list.push(...section.items.filter(i => !i.superAdminOnly || sa));
    if (section.groups) {
      for (const g of section.groups) list.push(...g.items.filter(i => !i.superAdminOnly || sa));
    }
    return list;
  }, [section, sa]);

  const filteredFlat = useMemo(() => {
    if (!searchQuery) return flatItems;
    return flatItems.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [flatItems, searchQuery]);

  const isAnyActive = flatItems.some(item =>
    location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href))
  );

  const [open, setOpen] = useState(isAnyActive);

  useEffect(() => { if (isAnyActive && !searchQuery) setOpen(true); }, [isAnyActive]);
  useEffect(() => { if (searchQuery && filteredFlat.length > 0) setOpen(true); }, [searchQuery, filteredFlat.length]);

  if (filteredFlat.length === 0 && searchQuery) return null;

  const isBkLocked = section.standalone && section.lockFeature
    ? planLoaded && !hasFeature(section.lockFeature)
    : false;

  const SectionIcon = section.icon;

  /* Collapsed sidebar: just show icon */
  if (sidebarCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 mb-0.5 ${
              isAnyActive ? "opacity-100" : "opacity-45 hover:opacity-75"
            }`}
            style={{
              backgroundColor: isAnyActive ? `${section.color}20` : "transparent",
              boxShadow: isAnyActive ? `0 0 0 1px ${section.color}30` : "none",
            }}
            onClick={() => setOpen(p => !p)}
          >
            <SectionIcon className="h-4 w-4" style={{ color: isAnyActive ? section.color : "currentColor" }} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">{section.label}</TooltipContent>
      </Tooltip>
    );
  }

  /* Standalone locked (bankruptcy) */
  if (section.standalone && isBkLocked) {
    return <BankruptcyLockedCard />;
  }

  /* Render items or groups */
  const renderItems = (items: NavItem[]) =>
    items.map(item => {
      const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
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
          showFavBtn
        />
      );
    });

  const renderGroups = (groups: NavGroup[], query: string) =>
    groups.map(g => {
      const gItems = g.items
        .filter(i => !i.superAdminOnly || sa)
        .filter(i => !query || i.label.toLowerCase().includes(query.toLowerCase()));
      if (gItems.length === 0) return null;
      const GIcon = g.groupIcon;
      return (
        <div key={g.groupLabel} className="mb-1">
          <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
            {GIcon && <GIcon className="h-3 w-3 text-sidebar-foreground/25 flex-shrink-0" />}
            <span className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-wider">{g.groupLabel}</span>
          </div>
          <div className="space-y-0.5">{renderItems(gItems)}</div>
        </div>
      );
    });

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center gap-2 px-2.5 py-[7px] rounded-xl text-[11.5px] font-semibold transition-all duration-150 min-h-[34px] ${
          isAnyActive
            ? "text-sidebar-foreground bg-sidebar-accent/40"
            : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/25"
        }`}
      >
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isAnyActive ? `${section.color}25` : "transparent",
            boxShadow: isAnyActive ? `0 0 0 1px ${section.color}35` : "none",
          }}>
          <SectionIcon className="h-3 w-3" style={{ color: isAnyActive ? section.color : "currentColor" }} />
        </div>
        <span className="flex-1 text-right truncate">{section.label}</span>
        {section.standalone && !isBkLocked && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 leading-none flex-shrink-0">
            ✓ نشط
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: isAnyActive ? section.color : "currentColor" }}
        />
      </button>

      {open && (
        <div
          className="mt-0.5 mb-0.5 space-y-0.5 pe-1 ms-5 border-r border-dashed"
          style={{ borderColor: `${section.color}25` }}
        >
          {section.groups
            ? renderGroups(section.groups, searchQuery)
            : renderItems(
                (section.items || [])
                  .filter(i => !i.superAdminOnly || sa)
                  .filter(i => !searchQuery || i.label.toLowerCase().includes(searchQuery.toLowerCase()))
              )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FAVORITES SECTION (top section when has items)
══════════════════════════════════════════════════════════════════════════ */
function FavoritesSection({
  favorites, allItems, location, onItemClick, onToggleFavorite, badges,
}: {
  favorites: string[]; allItems: NavItem[]; location: string;
  onItemClick?: () => void; onToggleFavorite: (href: string) => void;
  badges: Record<string, number>;
}) {
  const [open, setOpen] = useState(true);
  const favItems = allItems.filter(i => favorites.includes(i.href));
  if (favItems.length === 0) return null;

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-2.5 py-[7px] rounded-xl text-[11.5px] font-semibold text-amber-500/80 hover:text-amber-500 hover:bg-amber-500/8 transition-all duration-150 min-h-[34px]"
      >
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 bg-amber-500/15">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
        </div>
        <span className="flex-1 text-right">المفضلة</span>
        <span className="text-[9px] bg-amber-500/15 text-amber-500 font-bold px-1.5 py-0.5 rounded-full border border-amber-500/20 leading-none">
          {favItems.length}
        </span>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-0.5 mb-0.5 space-y-0.5 pe-1 ms-5 border-r border-dashed border-amber-500/20">
          {favItems.map(item => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            const badgeCount = item.badge ? badges[item.badge] : undefined;
            return (
              <NavItemLink
                key={item.href}
                item={item}
                isActive={isActive}
                onClick={onItemClick}
                badgeCount={badgeCount}
                accentColor="#F59E0B"
                isFavorite
                onToggleFavorite={() => onToggleFavorite(item.href)}
                showFavBtn
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RECENTS SECTION (by entity type)
══════════════════════════════════════════════════════════════════════════ */
function RecentsSection({
  recents, allItems, location, onItemClick, badges,
}: {
  recents: string[]; allItems: NavItem[]; location: string;
  onItemClick?: () => void; badges: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  const pageRecents = allItems
    .filter(i => recents.includes(i.href))
    .sort((a, b) => recents.indexOf(a.href) - recents.indexOf(b.href))
    .slice(0, 5);

  if (pageRecents.length === 0) return null;

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-2.5 py-[7px] rounded-xl text-[11.5px] font-semibold text-blue-500/70 hover:text-blue-500 hover:bg-blue-500/8 transition-all duration-150 min-h-[34px]"
      >
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-500/12">
          <History className="h-3 w-3 text-blue-400" />
        </div>
        <span className="flex-1 text-right">الأخيرة</span>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-0.5 mb-0.5 space-y-0.5 pe-1 ms-5 border-r border-dashed border-blue-500/20">
          {pageRecents.map(item => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <NavItemLink
                key={item.href}
                item={item}
                isActive={isActive}
                onClick={onItemClick}
                badgeCount={item.badge ? badges[item.badge] : undefined}
                accentColor="#3B82F6"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CONTEXT-AWARE CASE NAV (shown when inside a case)
══════════════════════════════════════════════════════════════════════════ */
function CaseContextNav({ location, onItemClick }: { location: string; onItemClick?: () => void }) {
  const match = location.match(/^\/cases\/([^/]+)/);
  if (!match) return null;
  const caseId = match[1];
  if (caseId === "new" || caseId === "import") return null;

  const base = `/cases/${caseId}`;
  const caseLinks = [
    { href: base,                label: "نظرة عامة",      icon: LayoutDashboard },
    { href: `${base}/hearings`, label: "الجلسات",         icon: Gavel },
    { href: `${base}/documents`,label: "المستندات",        icon: BookOpen },
    { href: `${base}/messages`, label: "المراسلات",        icon: MessageCircle },
    { href: `${base}/finance`,  label: "المالية",          icon: DollarSign },
    { href: `${base}/ai`,       label: "الذكاء الاصطناعي", icon: Sparkles },
    { href: `${base}/logs`,     label: "سجل الأحداث",      icon: Activity },
  ];

  return (
    <div className="mx-2 mb-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-500/15">
        <Scale className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
        <span className="text-[11px] font-bold text-indigo-500 truncate flex-1">القضية النشطة</span>
        <span className="text-[9px] bg-indigo-500/15 text-indigo-500 font-mono px-1.5 py-0.5 rounded border border-indigo-500/20 leading-none">
          #{caseId.slice(-6)}
        </span>
      </div>
      <div className="p-1 space-y-0.5">
        {caseLinks.map(link => {
          const isActive = location === link.href || location.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onItemClick}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                isActive
                  ? "bg-indigo-500/15 text-indigo-600 font-semibold"
                  : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <link.icon className="h-3.5 w-3.5 flex-shrink-0" style={isActive ? { color: "#6366F1" } : {}} />
              <span className="truncate">{link.label}</span>
              {isActive && <CheckCircle2 className="h-3 w-3 text-indigo-400 flex-shrink-0 mr-auto" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR SEARCH
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

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR FOOTER CARD (professional — point 9)
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
  const initials = displayName.slice(0, 2);

  const { data: officeData } = useQuery({
    queryKey: ["office-info-footer"],
    queryFn: () => fetch(`${basePath}/api/offices/my`).then(r => r.ok ? r.json() : null),
    staleTime: 10 * 60_000,
  });

  const [lastSync, setLastSync] = useState("الآن");
  useEffect(() => {
    setLastSync("الآن");
    const t = setTimeout(() => setLastSync("قبل دقيقة"), 60_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const statusCfg = {
    online: { label: "متصل",  color: "#22C55E", Icon: CircleDot },
    busy:   { label: "مشغول", color: "#F59E0B", Icon: Minus },
    away:   { label: "غائب",  color: "#94A3B8", Icon: Circle },
  };

  const setUserStatus = (s: UserStatus) => {
    setStatus(s);
    try { localStorage.setItem("user_status", s); } catch {}
  };

  const { Icon: StatusIcon } = statusCfg[status];
  const primary = branding?.primaryColor || "#2563EB";
  const officeName = branding?.officeName || officeData?.name || "مكتب المحاماة";
  const branch = officeData?.branch || officeData?.city || "المقر الرئيسي";

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
              <span className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar"
                style={{ backgroundColor: statusCfg[status].color }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">{displayName} — {statusCfg[status].label}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border p-2 shrink-0" ref={ref}>
      {/* Office + plan strip */}
      <div className="flex items-center gap-2 px-2 py-1.5 mb-1.5 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/30">
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt="" className="h-6 w-6 object-contain rounded-md flex-shrink-0" />
        ) : (
          <div className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
            {officeName[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-sidebar-foreground truncate leading-tight">{officeName}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="h-2.5 w-2.5 text-sidebar-foreground/35 flex-shrink-0" />
            <p className="text-[9px] text-sidebar-foreground/45 leading-tight truncate">{branch}</p>
          </div>
        </div>
        <div className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none ${
          plan?.isTrial ? "bg-amber-500/15 text-amber-600 border-amber-500/20" : "bg-emerald-500/15 text-emerald-600 border-emerald-500/20"
        }`}>
          {plan?.isTrial ? "تجريبي" : plan?.planName || "نشط"}
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
            <span className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar transition-colors"
              style={{ backgroundColor: statusCfg[status].color }} />
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[12px] font-semibold text-sidebar-foreground truncate leading-tight">{displayName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <StatusIcon className="h-2.5 w-2.5 flex-shrink-0" style={{ color: statusCfg[status].color }} />
              <span className="text-[10px] text-sidebar-foreground/45">{statusCfg[status].label}</span>
              <span className="text-sidebar-foreground/20 text-[10px] mx-0.5">·</span>
              <RefreshCw className="h-2.5 w-2.5 text-sidebar-foreground/25 flex-shrink-0" />
              <span className="text-[10px] text-sidebar-foreground/35 truncate">{lastSync}</span>
            </div>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-sidebar-foreground/30 transition-transform duration-200 ${showMenu ? "rotate-180" : ""}`} />
        </button>

        {showMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-xl shadow-2xl z-[300] overflow-hidden py-1">
            {/* Info row */}
            <div className="px-3 py-2 border-b border-border/40">
              <p className="text-[11px] font-bold text-foreground">{displayName}</p>
              <p className="text-[10px] text-muted-foreground">{officeName} · {branch}</p>
              <div className={`inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                plan?.isTrial ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              }`}>
                {plan?.isTrial ? "⏳ تجريبي" : `✓ ${plan?.planName || "Enterprise"}`}
              </div>
            </div>

            {/* Status */}
            <div className="px-3 py-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">الحالة</p>
              <div className="grid grid-cols-3 gap-1">
                {(["online", "busy", "away"] as UserStatus[]).map(s => (
                  <button key={s} onClick={() => setUserStatus(s)}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      status === s ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                    }`}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusCfg[s].color }} />
                    {statusCfg[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border/40 my-1" />

            {/* Actions */}
            {[
              { href: "/profile",        label: "الملف الشخصي",    icon: UserCheck },
              { href: "/office-settings",label: "الإعدادات",        icon: Settings },
              { href: "/support",        label: "المساعدة والدعم",  icon: HelpCircle },
              { href: "/billing",        label: "الاشتراك والباقة", icon: CreditCard },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                onClick={() => setShowMenu(false)}>
                <a.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {a.label}
              </Link>
            ))}
            <div className="border-t border-border/40 my-1" />
            <button onClick={onSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/8 transition-colors">
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
   SIDEBAR CONTENT (shared)
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

  const allItems = useMemo(
    () => getAllItems(NAV_SECTIONS, sa),
    [sa]
  );

  const visibleSections = NAV_SECTIONS.filter(s => !s.superAdminOnly || sa);

  return (
    <>
      {/* Search */}
      {!collapsed && <SidebarSearch value={search} onChange={setSearch} />}

      <div className={`flex-1 overflow-y-auto scrollbar-thin overflow-x-hidden ${collapsed ? "px-1 py-2 space-y-1" : "px-2 py-1 space-y-0.5"}`}>
        {/* Context-aware case nav */}
        {!collapsed && !search && <CaseContextNav location={location} onItemClick={onItemClick} />}

        {/* Favorites section (top) */}
        {!collapsed && !search && (
          <FavoritesSection
            favorites={favorites}
            allItems={allItems}
            location={location}
            onItemClick={onItemClick}
            onToggleFavorite={onToggleFavorite}
            badges={badges}
          />
        )}

        {/* Recents section */}
        {!collapsed && !search && (
          <RecentsSection
            recents={recents}
            allItems={allItems}
            location={location}
            onItemClick={onItemClick}
            badges={badges}
          />
        )}

        {/* Divider if quick-access sections exist */}
        {!collapsed && !search && (favorites.length > 0 || recents.length > 0) && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex-1 h-px bg-sidebar-border/40" />
            <span className="text-[9px] text-sidebar-foreground/25 font-semibold uppercase tracking-wider">جميع الأقسام</span>
            <div className="flex-1 h-px bg-sidebar-border/40" />
          </div>
        )}

        {/* All sections */}
        {visibleSections.map(section => (
          <NavSectionBlock
            key={section.id}
            section={section}
            location={location}
            badges={badges}
            onItemClick={onItemClick}
            isSuperAdmin={sa}
            sidebarCollapsed={collapsed}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            searchQuery={search}
          />
        ))}
      </div>
    </>
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
        <span className="animate-pulse">⚠️</span>
        <span>تنتهي تجربتك خلال <strong>{days === 0 ? "أقل من 24 ساعة" : `${days} ${days === 1 ? "يوم" : "أيام"}`}</strong> — حوّل مكتبك الآن</span>
      </div>
      <a href="/upgrade" className="shrink-0 px-3 py-1 rounded-full text-[10px] font-black border border-white/50 hover:bg-white/20 transition-colors whitespace-nowrap">اشترك الآن 🔥</a>
    </div>
  );
  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium z-50 shrink-0 ${urgent ? "bg-amber-50 border-b border-amber-200 text-amber-800" : "bg-emerald-50 border-b border-emerald-100 text-emerald-700"}`}>
      <div className="flex items-center gap-2">
        <span>{urgent ? "⏳" : "🎁"}</span>
        <span>{urgent ? "تجربتك المجانية تقترب من نهايتها — " : "فترة تجريبية مجانية — "}
          {trialDaysLeft != null && <span className="font-bold">{urgent && "تبقى "}{trialDaysLeft} {trialDaysLeft === 1 ? "يوم" : "أيام"}{urgent && " فقط"}</span>}
        </span>
      </div>
      <a href="/upgrade" className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors whitespace-nowrap ${urgent ? "border-amber-400 text-amber-800 hover:bg-amber-100" : "border-emerald-300 text-emerald-700 hover:bg-emerald-100"}`}>
        {urgent ? "اشترك الآن ←" : "عرض الخطط"}
      </a>
    </div>
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
    if (isLoaded && user && onboardingState && !onboardingState.completed && location !== "/onboarding") navigate("/onboarding");
  }, [isLoaded, user, onboardingState?.completed, location]);

  /* Badges */
  const { data: remindersData } = useQuery({
    queryKey: ["reminders-count"],
    queryFn: () => fetch(`${basePath}/api/reminders/count`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    enabled: isLoaded && !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const badges: Record<string, number> = { reminders: remindersData?.count ?? 0 };

  useEffect(() => { setIsMobileMenuOpen(false); }, [location]);
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  const primary = branding?.primaryColor || "#2563EB";
  const officeName = branding?.officeName || "عدالة AI";
  const handleSignOut = () => signOut({ redirectUrl: basePath || "/" });

  const sharedFooterProps = { user, displayName, branding, plan: { planName, isTrial }, onSignOut: handleSignOut };

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out overflow-hidden ${
          collapsed ? "w-[60px]" : "w-64"
        }`}
        style={{ flexShrink: 0 }}
      >
        {/* Header */}
        <div className={`flex h-16 items-center border-b border-sidebar-border shrink-0 ${collapsed ? "justify-center px-2" : "justify-between px-4 gap-3"}`}>
          {!collapsed && (
            <>
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt={officeName} className="h-9 w-9 object-contain rounded-xl bg-white/10 p-0.5 flex-shrink-0" />
              ) : (
                <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
                  {officeName[0]}
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold text-sidebar-foreground truncate leading-tight">{officeName}</span>
                <span className="text-[10px] text-sidebar-foreground/45 truncate leading-tight">{branding?.tagline || "منصة إدارة قانونية"}</span>
              </div>
            </>
          )}
          <button onClick={toggleCollapsed}
            className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-150"
            title={collapsed ? "توسيع القائمة" : "طي القائمة"}>
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
          <SidebarContent
            location={location} badges={badges} isSuperAdmin={isSuperAdmin}
            collapsed={collapsed} favorites={favorites} onToggleFavorite={toggleFavorite} recents={recents}
          />
        </div>

        {/* Footer */}
        <SidebarFooterCard {...sharedFooterProps} collapsed={collapsed} />
      </aside>

      {/* ── Mobile Sidebar ───────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute right-0 top-0 bottom-0 w-[300px] max-w-[90vw] bg-sidebar border-l border-sidebar-border flex flex-col shadow-2xl"
            style={{ animation: "slideInFromRight 0.25s cubic-bezier(0.16,1,0.3,1)" }}>
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
              <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg shrink-0"
                onClick={() => setIsMobileMenuOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col">
              <SidebarContent
                location={location} badges={badges} isSuperAdmin={isSuperAdmin}
                onItemClick={() => setIsMobileMenuOpen(false)}
                collapsed={false} favorites={favorites} onToggleFavorite={toggleFavorite} recents={recents}
              />
            </div>
            <SidebarFooterCard {...sharedFooterProps} collapsed={false} />
          </aside>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TrialBanner />

        <header className="flex h-14 md:h-16 items-center justify-between border-b bg-card px-3 sm:px-5 gap-2 shrink-0">
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

          <div className="hidden md:flex flex-1 items-center max-w-sm">
            <button onClick={() => (window as any).__openCommandBar?.()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-muted/40 hover:bg-muted/70 hover:border-border/80 transition-all text-sm text-muted-foreground group">
              <Search className="h-3.5 w-3.5 shrink-0 group-hover:text-foreground transition-colors" />
              <span className="flex-1 text-right text-[13px]">ابحث في القضايا، العملاء، العقود...</span>
              <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono border border-border/50 rounded px-1.5 py-0.5 bg-background/70 shrink-0">
                <span className="text-[11px]">⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1 mr-auto shrink-0">
            <button className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
              onClick={() => (window as any).__openCommandBar?.()}>
              <Search className="h-4.5 w-4.5" />
            </button>
            <LanguageSwitcher />
            <NotificationsPanel />
            <AccountMenu />
            <button onClick={handleSignOut} title="تسجيل الخروج"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-300 transition-all duration-150 me-1 shrink-0">
              <LogOut className="h-3.5 w-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">{children}</div>
      </main>

      <FloatingCopilot />
      <CommandBar />
    </div>
  );
}
