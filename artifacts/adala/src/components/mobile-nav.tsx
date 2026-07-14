/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
/**
 * Mobile-First Navigation Experience — عدالة AI
 * ─────────────────────────────────────────────
 * Components:
 *  1. MobileBottomNav       — fixed 5-tab bottom bar (mobile only)
 *  2. MobileMoreSheet       — full-screen navigation hub (المزيد)
 *  3. MobileFAB             — floating action button (quick create)
 *  4. MobileEntityContextBar — horizontal entity context links
 *  5. MobileSearchOverlay   — full-screen smart search
 *
 * Rules: desktop untouched · RBAC preserved · no new APIs · RTL-first
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Scale, Users, Bot, MoreHorizontal, Plus,
  FileText, FileSignature, Receipt, Gavel, ClipboardList,
  MessageCircle, X, Search, UserCircle, ChevronRight,
  Zap, Activity, Settings, LogOut, HelpCircle, BookOpen,
  DollarSign, Sparkles, Shield, BarChart3, ArrowUpRight,
  CheckCircle2, UserCog, GitBranch, Send, Clock,
  CalendarDays, PenTool, Network, BrainCircuit, Wallet,
  LayoutGrid, SlidersHorizontal, ChevronDown, Bell,
  Building2, MapPin, RefreshCw, CircleDot, Circle, Minus,
  Briefcase, Lock, Award, Globe, ShoppingBag, Crown,
  Layers, Workflow, Brain,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOfficePlan } from "@/hooks/use-office-plan";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { authFetch } from "@/lib/authFetch";
import { useQuery } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ══════════════════════════════════════════════════════════════════════
   SHARED DATA
══════════════════════════════════════════════════════════════════════ */

interface MobileQuickAction {
  id: string; label: string; icon: React.ComponentType<any>;
  href: string; color: string; feature?: string; permission?: string;
}
const MOBILE_QUICK_ACTIONS: MobileQuickAction[] = [
  { id: "new-case",     label: "قضية جديدة",      icon: Scale,         href: "/cases/new",               color: "#6366F1" },
  { id: "new-client",   label: "عميل جديد",        icon: UserCircle,    href: "/clients/new",             color: "#0EA5E9" },
  { id: "new-contract", label: "عقد جديد",         icon: FileSignature, href: "/contracts/new",           color: "#8B5CF6" },
  { id: "new-session",  label: "جلسة جديدة",       icon: Gavel,         href: "/hearings-calendar?new=1", color: "#F59E0B" },
  { id: "new-task",     label: "مهمة جديدة",       icon: ClipboardList, href: "/tasks?new=1",             color: "#10B981" },
  { id: "new-document", label: "مستند جديد",       icon: FileText,      href: "/documents/new",           color: "#6B7280" },
  { id: "new-invoice",  label: "فاتورة جديدة",     icon: Receipt,       href: "/invoices/new",            color: "#EC4899", permission: "financial:view" },
  { id: "new-message",  label: "مراسلة جديدة",     icon: MessageCircle, href: "/messages?new=1",          color: "#3B82F6" },
  { id: "ai-assistant", label: "المساعد القانوني", icon: Bot,           href: "/ai-hub",                  color: "#7C3AED", feature: "ai" },
];

interface MobileNavSection {
  id: string; label: string; icon: React.ComponentType<any>;
  href: string; color: string; superAdminOnly?: boolean;
  badge?: "reminders" | "messages";
}
const MOBILE_SECTIONS: MobileNavSection[] = [
  { id: "dashboard",   label: "لوحة التحكم",    icon: LayoutDashboard, href: "/dashboard",          color: "#3B82F6" },
  { id: "cases",       label: "القضايا",         icon: Scale,           href: "/cases",              color: "#6366F1" },
  { id: "crm",         label: "إدارة العملاء",   icon: Users,           href: "/clients",            color: "#0EA5E9" },
  { id: "docs",        label: "المستندات",        icon: BookOpen,        href: "/documents",          color: "#6B7280" },
  { id: "contracts",   label: "العقود",           icon: FileSignature,   href: "/contracts",          color: "#8B5CF6" },
  { id: "finance",     label: "المالية",          icon: DollarSign,      href: "/finance",            color: "#10B981" },
  { id: "invoices",    label: "الفواتير",         icon: Receipt,         href: "/invoices",           color: "#EC4899" },
  { id: "ai",          label: "مركز الذكاء",     icon: Sparkles,        href: "/ai-hub",             color: "#7C3AED" },
  { id: "comms",       label: "التواصل",          icon: MessageCircle,   href: "/messages",           color: "#6366F1", badge: "messages" },
  { id: "calendar",    label: "التقويم",          icon: CalendarDays,    href: "/hearings-calendar",  color: "#F59E0B" },
  { id: "tasks",       label: "المهام",           icon: ClipboardList,   href: "/tasks",              color: "#EF4444" },
  { id: "analytics",   label: "التحليلات",        icon: BarChart3,       href: "/analytics",          color: "#64748B" },
  { id: "hr",          label: "الموارد البشرية",  icon: Award,           href: "/hr-center",          color: "#F59E0B" },
  { id: "bankruptcy",  label: "الإفلاس",          icon: Briefcase,       href: "/bankruptcy",         color: "#EF4444" },
  { id: "jlwm",        label: "مركز القيادة القانونية", icon: Brain,      href: "/jlwm",               color: "#8B5CF6" },
  { id: "superadmin",  label: "إدارة المنصة",     icon: Shield,          href: "/super-admin",        color: "#EF4444", superAdminOnly: true },
];

/* ══════════════════════════════════════════════════════════════════════
   ENTITY DETECTION (for context bar)
══════════════════════════════════════════════════════════════════════ */
interface EntityCtxMobile {
  type: string; id: string; label: string; color: string;
  icon: React.ComponentType<any>;
  links: { href: string; label: string; icon: React.ComponentType<any> }[];
}

function detectMobileEntity(location: string): EntityCtxMobile | null {
  const patterns: Array<{ regex: RegExp; type: string; skip: string[] }> = [
    { regex: /^\/cases\/([^/]+)/,     type: "case",     skip: ["new","import"] },
    { regex: /^\/clients\/([^/]+)/,   type: "client",   skip: ["new"] },
    { regex: /^\/contracts\/([^/]+)/, type: "contract", skip: ["new"] },
    { regex: /^\/documents\/([^/]+)/, type: "document", skip: ["new"] },
    { regex: /^\/invoices\/([^/]+)/,  type: "invoice",  skip: ["new"] },
    { regex: /^\/employees\/([^/]+)/, type: "employee", skip: ["new"] },
  ];
  for (const p of patterns) {
    const m = location.match(p.regex);
    if (!m) continue;
    const id = m[1];
    if (p.skip.includes(id)) continue;
    const plural: Record<string,string> = { case:"cases", client:"clients", contract:"contracts", document:"documents", invoice:"invoices", employee:"employees" };
    const base = `/${plural[p.type]}/${id}`;
    const configs: Record<string, Omit<EntityCtxMobile, "id">> = {
      case:     { type:"case",     label:"القضية",   color:"#6366F1", icon:Scale, links:[
        { href: base,                label:"نظرة عامة",   icon:LayoutDashboard },
        { href:`${base}/hearings`,   label:"الجلسات",     icon:Gavel },
        { href:`${base}/documents`,  label:"المستندات",    icon:BookOpen },
        { href:`${base}/messages`,   label:"المراسلات",    icon:MessageCircle },
        { href:`${base}/finance`,    label:"المالية",      icon:DollarSign },
        { href:`${base}/ai`,         label:"الذكاء",       icon:Sparkles },
        { href:`${base}/logs`,       label:"السجل",        icon:Activity },
      ]},
      client:   { type:"client",   label:"العميل",   color:"#0EA5E9", icon:UserCircle, links:[
        { href: base,                label:"نظرة عامة",   icon:LayoutDashboard },
        { href:`${base}/cases`,      label:"القضايا",     icon:Scale },
        { href:`${base}/contracts`,  label:"العقود",      icon:FileSignature },
        { href:`${base}/invoices`,   label:"الفواتير",    icon:Receipt },
        { href:`${base}/documents`,  label:"المستندات",    icon:BookOpen },
        { href:`${base}/messages`,   label:"المراسلات",    icon:MessageCircle },
        { href:`${base}/logs`,       label:"السجل",        icon:Activity },
      ]},
      contract: { type:"contract", label:"العقد",    color:"#8B5CF6", icon:FileSignature, links:[
        { href: base,                label:"نظرة عامة",   icon:LayoutDashboard },
        { href:`${base}/parties`,    label:"الأطراف",     icon:Users },
        { href:`${base}/clauses`,    label:"البنود",      icon:FileText },
        { href:`${base}/documents`,  label:"المستندات",    icon:BookOpen },
        { href:`${base}/payments`,   label:"المدفوعات",   icon:DollarSign },
        { href:`${base}/logs`,       label:"السجل",        icon:Activity },
      ]},
      document: { type:"document", label:"المستند",  color:"#6B7280", icon:FileText, links:[
        { href: base,                label:"عرض",          icon:BookOpen },
        { href:`${base}/versions`,   label:"الإصدارات",   icon:GitBranch },
        { href:`${base}/sign`,       label:"التوقيع",      icon:PenTool },
        { href:`${base}/logs`,       label:"السجل",        icon:Activity },
      ]},
      invoice:  { type:"invoice",  label:"الفاتورة", color:"#EC4899", icon:Receipt, links:[
        { href: base,                label:"التفاصيل",    icon:Receipt },
        { href:`${base}/payments`,   label:"المدفوعات",   icon:DollarSign },
        { href:`${base}/send`,       label:"إرسال",        icon:Send },
        { href:`${base}/logs`,       label:"السجل",        icon:Activity },
      ]},
      employee: { type:"employee", label:"الموظف",   color:"#F59E0B", icon:UserCog, links:[
        { href: base,                label:"نظرة عامة",   icon:LayoutDashboard },
        { href:`${base}/attendance`, label:"الحضور",      icon:Clock },
        { href:`${base}/leaves`,     label:"الإجازات",   icon:CalendarDays },
        { href:`${base}/payroll`,    label:"الرواتب",     icon:DollarSign },
        { href:`${base}/logs`,       label:"السجل",        icon:Activity },
      ]},
    };
    return { id, ...configs[p.type] };
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════
   1. MOBILE BOTTOM NAV
══════════════════════════════════════════════════════════════════════ */
export function MobileBottomNav({
  badges, isSuperAdmin, onMoreOpen,
}: {
  badges: Record<string, number>;
  isSuperAdmin: boolean;
  onMoreOpen: () => void;
}) {
  const [location] = useLocation();

  const tabs = [
    { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard, href: "/dashboard", color: "#3B82F6" },
    { id: "cases",     label: "القضايا",   icon: Scale,           href: "/cases",     color: "#6366F1" },
    { id: "clients",   label: "العملاء",   icon: Users,           href: "/clients",   color: "#0EA5E9" },
    { id: "ai",        label: "الذكاء",    icon: Bot,             href: "/ai-hub",    color: "#7C3AED" },
  ] as const;

  const isTabActive = (href: string) =>
    location === href || (href !== "/dashboard" && location.startsWith(href));

  const isMoreActive = !tabs.some(t => isTabActive(t.href));

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[150] bg-card border-t border-border shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="navigation"
      aria-label="التنقل السفلي"
    >
      <div className="flex items-stretch h-16">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          const active = isTabActive(tab.href);
          const badgeCount = tab.id === "cases" ? (badges.reminders ?? 0) : 0;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors duration-150 min-h-[44px] touch-manipulation"
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <div
                className="relative h-7 w-7 rounded-xl flex items-center justify-center transition-all duration-200"
                style={{
                  backgroundColor: active ? `${tab.color}18` : "transparent",
                  transform: active ? "scale(1.08)" : "scale(1)",
                }}
              >
                <TabIcon
                  className="h-5 w-5 transition-colors duration-150"
                  style={{ color: active ? tab.color : "var(--muted-foreground)" }}
                />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-semibold leading-none transition-colors duration-150"
                style={{ color: active ? tab.color : "var(--muted-foreground)" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* المزيد */}
        <button
          onClick={onMoreOpen}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] touch-manipulation transition-colors duration-150"
          aria-label="المزيد"
          aria-expanded={false}
        >
          <div
            className="h-7 w-7 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{ backgroundColor: isMoreActive ? "#64748B18" : "transparent" }}
          >
            <MoreHorizontal
              className="h-5 w-5"
              style={{ color: isMoreActive ? "#64748B" : "var(--muted-foreground)" }}
            />
          </div>
          <span
            className="text-[10px] font-semibold leading-none"
            style={{ color: isMoreActive ? "#64748B" : "var(--muted-foreground)" }}
          >
            المزيد
          </span>
        </button>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   2. MOBILE MORE SHEET (full-screen hub)
══════════════════════════════════════════════════════════════════════ */
export function MobileMoreSheet({
  open, onClose, badges, isSuperAdmin,
  user, displayName, branding, plan, onSignOut,
  favorites, onToggleFavorite,
}: {
  open: boolean; onClose: () => void;
  badges: Record<string, number>; isSuperAdmin: boolean;
  user: any; displayName: string; branding: any;
  plan: { planName?: string; isTrial?: boolean };
  onSignOut: () => void;
  favorites: string[]; onToggleFavorite: (href: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const authReady = useAuthReady();
  const { data: officeData } = useQuery({
    queryKey: ["office-info-mobile"],
    queryFn: () => authFetch(`${basePath}/api/offices/my`).then(r => r.ok ? r.json() : null),
    staleTime: 10 * 60_000,
    enabled: open && authReady,
  });

  useEffect(() => {
    if (!open) { setSearch(""); setShowSearch(false); }
  }, [open]);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 100);
  }, [showSearch]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const visibleSections = MOBILE_SECTIONS.filter(s => !s.superAdminOnly || isSuperAdmin);
  const filteredSections = search
    ? visibleSections.filter(s => s.label.includes(search))
    : visibleSections;

  const primary = branding?.primaryColor || "#2563EB";
  const officeName = branding?.officeName || officeData?.name || "مكتب المحاماة";
  const branch = officeData?.branch || officeData?.city || "المقر الرئيسي";

  if (!open) return null;

  return (
    <div
      className="md:hidden fixed inset-0 z-[180] flex flex-col bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="قائمة التنقل"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-2.5">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-8 w-8 rounded-xl object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white font-black text-sm"
              style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
              {officeName[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-bold leading-tight">{officeName}</p>
            <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />{branch}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted/50 text-muted-foreground hover:bg-muted active:scale-95 transition-all touch-manipulation"
          aria-label="إغلاق"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* Search bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              inputMode="search"
              placeholder="ابحث في الأقسام..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-muted/50 border border-border/50 rounded-xl py-2.5 pr-10 pl-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground touch-manipulation">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        {!search && <MobileQuickActionsGrid onClose={onClose} />}

        {/* Favorites */}
        {!search && favorites.length > 0 && (
          <MobileFavoritesRow favorites={favorites} onClose={onClose} />
        )}

        {/* Sections */}
        <div className="px-4 pb-2">
          {!search && (
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2">الأقسام</p>
          )}
          <div className="space-y-1">
            {filteredSections.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد نتائج</p>
            )}
            {filteredSections.map(section => {
              const SIcon = section.icon;
              const badgeCount = section.badge ? (badges[section.badge] ?? 0) : 0;
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  onClick={onClose}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 active:scale-[0.98] transition-all duration-150 touch-manipulation min-h-[52px]"
                >
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${section.color}15` }}>
                    <SIcon className="h-4.5 w-4.5" style={{ color: section.color }} />
                  </div>
                  <span className="flex-1 text-sm font-semibold leading-tight">{section.label}</span>
                  {badgeCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                      {badgeCount}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 rotate-180" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Settings links */}
        {!search && (
          <div className="px-4 pb-4 mt-1">
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2">الإعدادات</p>
            <div className="space-y-1">
              {[
                { label: "الملف الشخصي",     icon: UserCircle, href: "/my-sessions" },
                { label: "إعدادات المكتب",   icon: Settings,   href: "/office-settings" },
                { label: "الاشتراك والباقة", icon: Crown,      href: "/billing" },
                { label: "المساعدة والدعم",  icon: HelpCircle, href: "/firm-admin" },
              ].map(item => {
                const IIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 active:scale-[0.98] transition-all duration-150 touch-manipulation min-h-[44px]"
                  >
                    <IIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0 mr-auto rotate-180" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Plan banner */}
        {!search && plan.isTrial && (
          <div className="mx-4 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs font-bold text-amber-600 mb-1">⏳ فترة تجريبية نشطة</p>
            <Link href="/billing" onClick={onClose}
              className="text-[11px] text-amber-600 hover:underline">
              ترقية الباقة →
            </Link>
          </div>
        )}
      </div>

      {/* User card footer */}
      <div className="border-t border-border bg-card px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border flex-shrink-0">
            {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
              {displayName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate leading-tight">{displayName}</p>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">
              {plan.planName || "الباقة الأساسية"}
              {plan.isTrial && " • تجريبي"}
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/10 active:scale-95 transition-all touch-manipulation"
            title="تسجيل الخروج"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Quick Actions sub-grid for More sheet */
function MobileQuickActionsGrid({ onClose }: { onClose: () => void }) {
  const { hasFeature, isLoaded: planLoaded } = useOfficePlan();
  const { hasPermission, isLoaded: permLoaded } = usePermissions();
  const [open, setOpen] = useState(true);

  const visible = MOBILE_QUICK_ACTIONS.filter(a => {
    if (permLoaded && a.permission && !hasPermission(a.permission)) return false;
    if (planLoaded && a.feature && !hasFeature(a.feature)) return false;
    return true;
  });

  return (
    <div className="px-4 pb-3">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 mb-2 w-full"
      >
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider flex-1 text-right">إجراءات سريعة</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid grid-cols-3 gap-2">
          {visible.map(action => {
            const AIcon = action.icon;
            return (
              <Link
                key={action.id}
                href={action.href}
                onClick={onClose}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 active:scale-95 transition-all duration-150 touch-manipulation min-h-[72px]"
              >
                <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${action.color}18` }}>
                  <AIcon className="h-4.5 w-4.5" style={{ color: action.color }} />
                </div>
                <span className="text-[10px] font-semibold text-center leading-tight text-muted-foreground">{action.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Favorites row for More sheet */
function MobileFavoritesRow({
  favorites, onClose,
}: { favorites: string[]; onClose: () => void }) {
  if (favorites.length === 0) return null;
  const sections = MOBILE_SECTIONS.filter(s => favorites.includes(s.href));
  if (sections.length === 0) return null;

  return (
    <div className="px-4 pb-3">
      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1">
        ⭐ المفضلة
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {sections.map(s => {
          const SIcon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              onClick={onClose}
              className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 active:scale-95 transition-all flex-shrink-0 w-16 touch-manipulation"
            >
              <SIcon className="h-5 w-5" style={{ color: s.color }} />
              <span className="text-[9px] font-semibold text-center text-muted-foreground leading-tight truncate w-full">{s.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   3. MOBILE FAB (floating action button)
══════════════════════════════════════════════════════════════════════ */
export function MobileFAB() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { hasFeature, isLoaded: planLoaded } = useOfficePlan();
  const { hasPermission, isLoaded: permLoaded } = usePermissions();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on location change
  useEffect(() => { setOpen(false); }, [location]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visible = MOBILE_QUICK_ACTIONS.filter(a => {
    if (permLoaded && a.permission && !hasPermission(a.permission)) return false;
    if (planLoaded && a.feature && !hasFeature(a.feature)) return false;
    return true;
  });

  return (
    <div
      ref={containerRef}
      className="md:hidden fixed z-[160] touch-manipulation"
      style={{
        bottom: `calc(env(safe-area-inset-bottom, 0px) + 80px)`,
        left: "16px",
      }}
    >
      {/* Action items — radial up */}
      {open && (
        <div className="absolute bottom-14 left-0 flex flex-col-reverse gap-2 pb-1">
          {visible.map((action, i) => {
            const AIcon = action.icon;
            return (
              <Link
                key={action.id}
                href={action.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl shadow-lg border border-border/50 bg-card hover:bg-muted/60 active:scale-95 transition-all duration-150 min-w-[140px]"
                style={{
                  animation: `fabItemIn 0.2s ease ${i * 0.035}s both`,
                }}
              >
                <div className="h-7 w-7 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${action.color}18` }}>
                  <AIcon className="h-3.5 w-3.5" style={{ color: action.color }} />
                </div>
                <span className="text-xs font-semibold whitespace-nowrap">{action.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setOpen(false)}
          style={{ background: "rgba(0,0,0,0.25)" }}
        />
      )}

      {/* Main FAB button */}
      <button
        onClick={() => setOpen(p => !p)}
        className="h-13 w-13 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 active:scale-95 transition-all duration-200"
        style={{
          background: open
            ? "linear-gradient(135deg, #EF4444, #DC2626)"
            : "linear-gradient(135deg, #2563EB, #1D4ED8)",
          width: "52px",
          height: "52px",
        }}
        aria-label={open ? "إغلاق القائمة" : "إجراءات سريعة"}
        aria-expanded={open}
      >
        <div className="transition-transform duration-200" style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>
          <Plus className="h-6 w-6 text-white" />
        </div>
      </button>

      <style>{`
        @keyframes fabItemIn {
          from { opacity: 0; transform: translateY(8px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   4. MOBILE ENTITY CONTEXT BAR
   — horizontal scrollable pills, appears below header on entity pages
══════════════════════════════════════════════════════════════════════ */
export function MobileEntityContextBar() {
  const [location] = useLocation();
  const ctx = detectMobileEntity(location);
  if (!ctx) return null;

  const HeaderIcon = ctx.icon;

  return (
    <div
      className="md:hidden border-b border-border bg-card shrink-0"
      style={{ borderTopColor: `${ctx.color}20` }}
    >
      {/* Entity label */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b"
        style={{ borderColor: `${ctx.color}15`, backgroundColor: `${ctx.color}06` }}>
        <HeaderIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: ctx.color }} />
        <span className="text-[11px] font-bold flex-1" style={{ color: ctx.color }}>{ctx.label}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border leading-none"
          style={{ backgroundColor: `${ctx.color}15`, color: ctx.color, borderColor: `${ctx.color}25` }}>
          #{ctx.id.slice(-6)}
        </span>
      </div>
      {/* Scrollable links */}
      <div
        className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none"
        role="navigation"
        aria-label={`روابط ${ctx.label}`}
      >
        {ctx.links.map(link => {
          const isActive = location === link.href || location.startsWith(link.href + "/");
          const LIcon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-150 touch-manipulation"
              style={isActive
                ? { backgroundColor: `${ctx.color}18`, color: ctx.color, fontWeight: 700 }
                : { color: "var(--muted-foreground)" }}
              aria-current={isActive ? "page" : undefined}
            >
              <LIcon className="h-3.5 w-3.5 flex-shrink-0" style={isActive ? { color: ctx.color } : {}} />
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
