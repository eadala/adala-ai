import { lazy, Suspense, useEffect, useRef, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import Landing from "@/pages/landing"; // eager — public homepage must never be lazy-blocked
import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AdminLayout } from "@/components/admin-layout";
import { useRole } from "@/hooks/use-role";
import { usePermissions } from "@/hooks/use-permissions";
import { OfficeThemeProvider } from "@/components/office-theme-provider";

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
// Core (likely first visit)
const Dashboard            = lazy(() => import("@/pages/dashboard"));
// Landing is eagerly imported above — do NOT add it here
const OnboardingPage       = lazy(() => import("@/pages/platform/onboarding"));

// Cases & Clients
const Cases                = lazy(() => import("@/pages/legal-core/cases"));
const CaseDetail           = lazy(() => import("@/pages/legal-core/case-detail"));
const HearingsCalendar     = lazy(() => import("@/pages/legal-core/hearings-calendar"));
const Clients              = lazy(() => import("@/pages/legal-core/clients"));
const ClientDetail         = lazy(() => import("@/pages/legal-core/client-detail"));
const Contracts            = lazy(() => import("@/pages/legal-core/contracts"));

// Documents & Files
const Documents            = lazy(() => import("@/pages/legal-core/documents"));
const Letters              = lazy(() => import("@/pages/legal-core/letters"));
const Warnings             = lazy(() => import("@/pages/legal-core/warnings"));

// Platform
const BranchesPage         = lazy(() => import("@/pages/platform/branches"));

// AI Suite
const AiTasks              = lazy(() => import("@/pages/ai/ai-tasks"));
const AIRouterDashboard    = lazy(() => import("@/pages/ai/ai-router-dashboard"));
const AIHub                = lazy(() => import("@/pages/ai/ai-hub"));
const AICopilotPage        = lazy(() => import("@/pages/ai/ai-copilot"));
const AiChat               = lazy(() => import("@/pages/ai/ai-chat"));
const AdoulPage            = lazy(() => import("@/pages/legal-core/adoul"));
const OpponentSimulator    = lazy(() => import("@/pages/legal-core/opponent-simulator"));
const AiAgents             = lazy(() => import("@/pages/ai/ai-agents"));
const CommandCenter        = lazy(() => import("@/pages/ai/command-center"));
const LegalAIPage          = lazy(() => import("@/pages/legal-core/legal-ai"));
const AIAssistant          = lazy(() => import("@/pages/ai/ai-assistant"));

// Legal & Research
const LegalResearch        = lazy(() => import("@/pages/legal-core/legal-research"));
const Arbitration          = lazy(() => import("@/pages/legal-core/arbitration"));
const JudgePrep            = lazy(() => import("@/pages/legal-core/judge-prep"));
const SaudiSystems         = lazy(() => import("@/pages/legal-core/saudi-systems"));
const MediatorsPage        = lazy(() => import("@/pages/legal-core/mediators"));
const RiskManagement       = lazy(() => import("@/pages/legal-core/risk-management"));
const Compliance           = lazy(() => import("@/pages/legal-core/compliance"));

// Finance & Accounting
const Invoices             = lazy(() => import("@/pages/financial/invoices"));
const InvoicePublic        = lazy(() => import("@/pages/financial/invoice-public"));
const Revenues             = lazy(() => import("@/pages/financial/revenues"));
const Expenses             = lazy(() => import("@/pages/financial/expenses"));
const FinancialReports     = lazy(() => import("@/pages/financial/financial-reports"));
const TaxSettings          = lazy(() => import("@/pages/financial/tax-settings"));
const FinancialStatements  = lazy(() => import("@/pages/financial/financial-statements"));
const UIBuilder            = lazy(() => import("@/pages/ai/ui-builder"));
const Cashflow             = lazy(() => import("@/pages/financial/cashflow"));
const BankAccounts         = lazy(() => import("@/pages/financial/bank-accounts"));
const Advances             = lazy(() => import("@/pages/financial/advances"));
const PaymentCenter        = lazy(() => import("@/pages/financial/payment-center"));
const FinanceCenter        = lazy(() => import("@/pages/financial/finance-center"));
const Collections          = lazy(() => import("@/pages/financial/collections"));
const FinancialIntelligence = lazy(() => import("@/pages/financial/financial-intelligence"));
const FinancialCore        = lazy(() => import("@/pages/financial/financial-core"));
const EnterpriseFinance    = lazy(() => import("@/pages/financial/enterprise-finance"));

// HR
const Employees            = lazy(() => import("@/pages/hr/employees"));
const Attendance           = lazy(() => import("@/pages/hr/attendance"));
const Leaves               = lazy(() => import("@/pages/hr/leaves"));
const Payroll              = lazy(() => import("@/pages/hr/payroll"));
const HRCenter             = lazy(() => import("@/pages/hr/hr-center"));
const HREnterprise         = lazy(() => import("@/pages/hr/hr-enterprise"));
const HRSystems            = lazy(() => import("@/pages/hr/hr-systems"));
const OrgStructure         = lazy(() => import("@/pages/hr/org-structure"));

// Admin & Settings
const Users                = lazy(() => import("@/pages/platform/users"));
const Team                 = lazy(() => import("@/pages/platform/team"));
const OfficeSettings       = lazy(() => import("@/pages/platform/office-settings"));
const OfficeManagement     = lazy(() => import("@/pages/platform/office-management"));
const WebsiteBuilder       = lazy(() => import("@/pages/platform/website-builder"));
const SuperAdmin           = lazy(() => import("@/pages/platform/super-admin"));
const FirmAdmin            = lazy(() => import("@/pages/platform/firm-admin"));
const BackupCenter         = lazy(() => import("@/pages/platform/backup"));
const StorageSettings      = lazy(() => import("@/pages/platform/storage-settings"));
const DocumentCenter       = lazy(() => import("@/pages/platform/document-center"));
const AdalaBuildStudio     = lazy(() => import("@/pages/platform/studio"));
const ThemeBuilderPage     = lazy(() => import("@/pages/platform/theme-builder"));
const EngineeringCenter    = lazy(() => import("@/pages/platform/engineering-center"));
const AICommandCenter      = lazy(() => import("@/pages/platform/ai-command-center"));
const AIWorkflowBuilder    = lazy(() => import("@/pages/platform/ai-workflow-builder"));
const ControlTowerPage     = lazy(() => import("@/pages/platform/control-tower"));
const SaasOSPage           = lazy(() => import("@/pages/platform/saas-os"));
const ProductionOSPage     = lazy(() => import("@/pages/platform/production-os"));
const CommercialLaunchPage = lazy(() => import("@/pages/platform/commercial-launch"));
const AiCooPage            = lazy(() => import("@/pages/ai/ai-coo"));
const MonitoringPage       = lazy(() => import("@/pages/monitoring/monitoring"));
const PreventionPage       = lazy(() => import("@/pages/monitoring/prevention"));
const AlertsPage           = lazy(() => import("@/pages/monitoring/alerts"));
const FinancialEnginePage  = lazy(() => import("@/pages/financial/financial-engine"));
const FinanceDashboard     = lazy(() => import("@/pages/financial/finance-dashboard"));
const IsolationPage        = lazy(() => import("@/pages/monitoring/isolation"));
const HardeningPage        = lazy(() => import("@/pages/monitoring/hardening"));
const ZeroTrustShieldPage  = lazy(() => import("@/pages/platform/zero-trust-shield"));
const LaunchGatePage            = lazy(() => import("@/pages/platform/launch-gate"));
const ProductionLaunchCenter    = lazy(() => import("@/pages/platform/production-launch"));
const LegalOSPage          = lazy(() => import("@/pages/legal-core/legal-os"));
const SelfHealingPage      = lazy(() => import("@/pages/monitoring/self-healing"));
const AuditLogsPage        = lazy(() => import("@/pages/platform/audit-logs"));
const SOCPage              = lazy(() => import("@/pages/platform/soc"));
const AuditCenterPage      = lazy(() => import("@/pages/platform/audit-center"));
const ExecutiveDashboard   = lazy(() => import("@/pages/platform/executive-dashboard"));
const IntegrationsPage     = lazy(() => import("@/pages/platform/integrations"));
const LoginTrackingPage    = lazy(() => import("@/pages/platform/login-tracking"));
const MySessionsPage       = lazy(() => import("@/pages/platform/my-sessions"));
const MyProfilePage        = lazy(() => import("@/pages/my-profile"));
const ActivityStreamPage   = lazy(() => import("@/pages/monitoring/activity-stream"));

// Communication
const Messages             = lazy(() => import("@/pages/operations/messages"));
const RemindersPage        = lazy(() => import("@/pages/legal-core/reminders"));
const EmailNotificationsPage = lazy(() => import("@/pages/operations/email-notifications"));
const WhatsAppSettingsPage  = lazy(() => import("@/pages/operations/whatsapp-settings"));
const TelegramSettingsPage        = lazy(() => import("@/pages/operations/telegram-settings"));
const NotificationSettingsPage   = lazy(() => import("@/pages/operations/notification-settings"));
const DocumentTemplatesPage = lazy(() => import("@/pages/legal-core/document-templates"));
const SupportPage          = lazy(() => import("@/pages/platform/support"));

// Analytics & Reports
const Analytics            = lazy(() => import("@/pages/operations/analytics"));
const Tasks                = lazy(() => import("@/pages/operations/tasks"));
const CalendarPage         = lazy(() => import("@/pages/operations/calendar"));

// Bankruptcy Module
const BankruptcyPage       = lazy(() => import("@/pages/bankruptcy"));

// Client Portal
const ClientPortal         = lazy(() => import("@/pages/marketplace/client-portal"));
const PortalView           = lazy(() => import("@/pages/marketplace/portal-view"));
const PortalLogin          = lazy(() => import("@/pages/marketplace/portal-login"));
const PortalMyCases        = lazy(() => import("@/pages/marketplace/portal-my-cases"));
const SignPage              = lazy(() => import("@/pages/legal-core/sign"));

// Marketplace & Public
const Marketplace          = lazy(() => import("@/pages/marketplace/marketplace"));
const Billing              = lazy(() => import("@/pages/financial/billing"));
const UpgradePage          = lazy(() => import("@/pages/platform/upgrade"));
const PricingPage          = lazy(() => import("@/pages/marketplace/pricing"));
const DemoPage             = lazy(() => import("@/pages/demo"));
const DemoLoginPage        = lazy(() => import("@/pages/demo-login"));
const LiveDemoPage         = lazy(() => import("@/pages/live-demo"));
const OfficePage           = lazy(() => import("@/pages/marketplace/office-public"));
const OfficeServiceDetail  = lazy(() => import("@/pages/marketplace/office-service-detail"));
const OfficeStore          = lazy(() => import("@/pages/marketplace/office-store"));
const OfficeBankruptcy     = lazy(() => import("@/pages/marketplace/office-bankruptcy"));
const OfficeBook           = lazy(() => import("@/pages/marketplace/office-book"));
const OfficeLogin          = lazy(() => import("@/pages/marketplace/office-login"));
const TermsPage            = lazy(() => import("@/pages/terms"));
const PrivacyPage          = lazy(() => import("@/pages/privacy"));
const SecurityPage         = lazy(() => import("@/pages/security"));
const SystemStatusPage     = lazy(() => import("@/pages/platform/system-status"));
const ReferralPage         = lazy(() => import("@/pages/marketplace/referral"));
const NotFound             = lazy(() => import("@/pages/not-found"));

// JLWM — Justice Legal World Model (Phase 1 + Phase 2)
const JLWMDashboard           = lazy(() => import("@/pages/jlwm/index"));
const JLWMWorldState          = lazy(() => import("@/pages/jlwm/world-state"));
const JLWMMemoryGraph         = lazy(() => import("@/pages/jlwm/memory-graph"));
const JLWMCommandCenter       = lazy(() => import("@/pages/jlwm/command-center"));
const JLWMPredictions         = lazy(() => import("@/pages/jlwm/predictions"));
const JLWMFutureExplorer      = lazy(() => import("@/pages/jlwm/future-explorer"));
const JLWMSimulation          = lazy(() => import("@/pages/jlwm/simulation"));
const JLWMLitigationIntel     = lazy(() => import("@/pages/jlwm/litigation-intelligence"));
// JLWM Phase 3 — Validation & Executive Intelligence
const JLWMPredictionAccuracy  = lazy(() => import("@/pages/jlwm/prediction-accuracy"));
const JLWMExecutiveIntel      = lazy(() => import("@/pages/jlwm/executive-intelligence"));
const JLWMLegalCOO            = lazy(() => import("@/pages/jlwm/legal-coo"));
const JLWMReliability         = lazy(() => import("@/pages/jlwm/reliability"));
// JLWM Phase 4 — Enterprise Integration, Security & Reliability
const JLWMEnterpriseReport    = lazy(() => import("@/pages/jlwm/enterprise-report"));

// Security
const TwoFactorSetup       = lazy(() => import("@/pages/2fa-setup"));
const TwoFactorVerify      = lazy(() => import("@/pages/2fa-verify"));

// ── Query client ───────────────────────────────────────────────────────────────
// staleTime=5min : data is fresh for 5 minutes, no duplicate network calls
// gcTime=10min   : reduced from 30min — frees stale office data faster,
//                  prevents cross-tenant data lingering in memory
// refetchOnWindowFocus=false: tab switching doesn't trigger request floods
// retry=1        : fail fast on bad routes, don't spam the server
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime:    10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: 1,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Use the publishable key directly from the environment variable.
// publishableKeyFromHost from @clerk/react/internal was throwing in production
// for the .replit.app hostname, which was corrupting the Clerk singleton and
// causing ClerkProvider to fail silently → blank page.
const clerkPubKey: string = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

// Replit sets VITE_CLERK_PROXY_URL to a relative path like "/api/__clerk"
// Clerk v6 requires an absolute URL in production — expand at runtime.
const _rawProxy = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkProxyUrl = _rawProxy
  ? _rawProxy.startsWith("/")
    ? `${window.location.origin}${_rawProxy}`
    : _rawProxy
  : undefined;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#2563EB",
    colorForeground: "#0F172A",
    colorMutedForeground: "#64748B",
    colorDanger: "#DC2626",
    colorBackground: "#FFFFFF",
    colorInput: "#F8FAFC",
    colorInputForeground: "#0F172A",
    colorNeutral: "#64748B",
    fontFamily: "'Cairo', sans-serif",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-[#E2E8F0]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900 font-bold text-xl",
    headerSubtitle: "text-slate-500 text-sm",
    socialButtonsBlockButtonText: "text-slate-700",
    formFieldLabel: "text-slate-600 text-sm",
    footerActionLink: "text-blue-600 hover:text-blue-700",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-blue-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-slate-700",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "!border-[#E2E8F0] !bg-white hover:!bg-[#F8FAFC] !text-slate-700",
    formButtonPrimary: "!bg-[#2563EB] hover:!bg-[#1D4ED8] !text-white font-bold",
    formFieldInput: "!bg-white !border-[#E2E8F0] !text-slate-900 placeholder:text-slate-400",
    footerAction: "!bg-[#F8FAFC] !border-t !border-[#E2E8F0]",
    dividerLine: "!bg-[#E2E8F0]",
    alert: "!bg-[#FFF7ED] !border-[#FED7AA]",
    otpCodeFieldInput: "!bg-white !border-[#E2E8F0] !text-slate-900",
    formFieldRow: "gap-3",
    main: "gap-4",
  },
};

// ── Loading fallback ───────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs">جاري التحميل…</span>
      </div>
    </div>
  );
}

// ── Auth Brand Panel — shared between sign-in & sign-up ─────────────────────
const AUTH_FEATURES = [
  { icon: "⚖️", text: "إدارة القضايا والجلسات بذكاء اصطناعي متقدم" },
  { icon: "📄", text: "عقود وفواتير احترافية في دقائق معدودة" },
  { icon: "🤖", text: "مساعد قانوني ذكي يحلل ويقترح في الحال" },
  { icon: "🔒", text: "بيانات مشفرة ومعزولة لكل مكتب" },
];

const AUTH_STATS = [
  { value: "+٤٥", label: "مكتب محاماة" },
  { value: "٩٩٪", label: "وقت تشغيل" },
  { value: "+٤٥٨٣", label: "قضية مُدارة" },
];

function AuthBrandPanel({ mode }: { mode: "signin" | "signup" }) {
  const isSignIn = mode === "signin";
  return (
    <div
      className="hidden lg:flex flex-col justify-between h-full p-12 relative overflow-hidden"
      style={{ background: "linear-gradient(155deg, #0B1F3B 0%, #132848 60%, #0D2040 100%)" }}
      dir="rtl"
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full blur-[100px]"
          style={{ background: "rgba(37,99,235,0.18)" }} />
        <div className="absolute bottom-1/4 left-1/3 w-56 h-56 rounded-full blur-[80px]"
          style={{ background: "rgba(124,58,237,0.10)" }} />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      {/* Logo */}
      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#2563EB", boxShadow: "0 4px 14px rgba(37,99,235,0.45)" }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-none stroke-white stroke-[2]">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="font-black text-xl text-white">
          عدالة <span style={{ color: "#60A5FA" }}>AI</span>
        </span>
      </div>

      {/* Main copy */}
      <div className="relative space-y-8">
        <div>
          <h1 className="text-3xl font-black text-white leading-tight mb-3" style={{ letterSpacing: "-0.02em" }}>
            {isSignIn ? (
              <>مرحباً بعودتك<br /><span style={{ color: "#60A5FA" }}>إلى منصتك القانونية</span></>
            ) : (
              <>ابدأ مكتبك القانوني<br /><span style={{ color: "#60A5FA" }}>بذكاء اصطناعي حقيقي</span></>
            )}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            {isSignIn
              ? "ادخل إلى لوحة التحكم وتابع قضاياك وعملاءك وفرقك في مكان واحد."
              : "منصة متكاملة لإدارة القضايا والعملاء والفوترة والذكاء الاصطناعي."}
          </p>
        </div>

        {/* Features */}
        <ul className="space-y-4">
          {AUTH_FEATURES.map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.20)", border: "1px solid rgba(37,99,235,0.30)" }}>
                {f.icon}
              </div>
              <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Stats strip */}
      <div className="relative grid grid-cols-3 gap-4 pt-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {AUTH_STATS.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-2xl font-black text-white">{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Auth pages ─────────────────────────────────────────────────────────────────
function SignInPage() {
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-2" dir="rtl">
      {/* Brand panel */}
      <AuthBrandPanel mode="signin" />

      {/* Form panel */}
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10"
        style={{ background: "linear-gradient(160deg, #F0F4FF 0%, #EEF2FF 100%)" }}
      >
        {/* Mobile-only logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "#2563EB", boxShadow: "0 4px 12px rgba(37,99,235,0.35)" }}>
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-none stroke-white stroke-[2]">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-black text-lg" style={{ color: "#0B1F3B" }}>
            عدالة <span style={{ color: "#2563EB" }}>AI</span>
          </span>
        </div>

        {/* Clerk sign-in */}
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={`${basePath}/dashboard`}
        />

        {/* Try simulation link */}
        <p className="mt-6 text-sm" style={{ color: "#64748B" }}>
          تريد الاستكشاف أولاً؟{" "}
          <a href={`${basePath}/demo-login`}
            className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: "#2563EB" }}>
            جرّب بيئة المحاكاة
          </a>
        </p>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-2" dir="rtl">
      {/* Brand panel */}
      <AuthBrandPanel mode="signup" />

      {/* Form panel */}
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10"
        style={{ background: "linear-gradient(160deg, #F0F4FF 0%, #EEF2FF 100%)" }}
      >
        {/* Mobile-only logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "#2563EB", boxShadow: "0 4px 12px rgba(37,99,235,0.35)" }}>
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-none stroke-white stroke-[2]">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-black text-lg" style={{ color: "#0B1F3B" }}>
            عدالة <span style={{ color: "#2563EB" }}>AI</span>
          </span>
        </div>

        {/* Clerk sign-up */}
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/dashboard`}
        />
      </div>
    </div>
  );
}

// ── Root error boundary ────────────────────────────────────────────────────────
// Professional recovery UI — no white screens, no data loss
interface EBState { error: Error | null; errorId: string }
class AppErrorBoundary extends Component<{ children: ReactNode; label?: string }, EBState> {
  state: EBState = { error: null, errorId: "" };

  static getDerivedStateFromError(error: Error): EBState {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    return { error, errorId };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const errorId = this.state.errorId;
    const label = (this.props as any).label ?? "root";
    console.error(`[Adala][${label}][${errorId}]`, error.message, info.componentStack?.slice(0, 400));
    // Send to monitoring (non-blocking)
    try {
      fetch("/api/monitoring/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorId,
          label,
          message: error.message,
          stack: error.stack?.slice(0, 1000),
          componentStack: info.componentStack?.slice(0, 500),
          url: window.location.pathname,
          ts: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch { /* non-fatal */ }
  }

  render() {
    const { error, errorId } = this.state;
    if (error) {
      const isModule = !!(this.props as any).label;
      if (isModule) {
        return (
          <div dir="rtl" style={{
            padding: "1.5rem", borderRadius: "0.75rem",
            background: "hsl(var(--card))", border: "1px solid hsl(var(--destructive)/0.3)",
            display: "flex", flexDirection: "column", gap: "0.75rem",
            fontFamily: "Cairo, sans-serif", color: "hsl(var(--foreground))",
            margin: "1rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>⚠️</span>
              <span style={{ fontWeight: 600, color: "hsl(var(--destructive))" }}>خطأ في تحميل هذا القسم</span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "hsl(var(--muted-foreground))", margin: 0 }}>
              تعذّر تحميل هذا الجزء من الصفحة. يمكنك المحاولة مجدداً أو العودة للرئيسية.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button onClick={() => this.setState({ error: null, errorId: "" })}
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: "0.375rem", padding: "0.375rem 1rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" }}>
                إعادة المحاولة
              </button>
              <button onClick={() => window.location.href = "/dashboard"}
                style={{ background: "transparent", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))", borderRadius: "0.375rem", padding: "0.375rem 1rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem" }}>
                الرئيسية
              </button>
            </div>
            <span style={{ fontSize: "0.7rem", color: "hsl(var(--muted-foreground)/0.5)", direction: "ltr" }}>{errorId}</span>
          </div>
        );
      }
      return (
        <div dir="rtl" style={{
          padding: "2rem", fontFamily: "Cairo, sans-serif",
          background: "hsl(var(--background))", minHeight: "100vh", color: "hsl(var(--foreground))",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.25rem",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "hsl(var(--destructive)/0.1)", border: "1px solid hsl(var(--destructive)/0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem",
          }}>⚠️</div>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h1 style={{ color: "hsl(var(--primary))", fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>حدث خطأ غير متوقع</h1>
            <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem", margin: 0, maxWidth: 360 }}>
              يرجى تحديث الصفحة. إذا استمرت المشكلة، تواصل مع الدعم مع رمز الخطأ أدناه.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => window.location.reload()}
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: "0.5rem", padding: "0.625rem 1.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.9rem" }}>
              تحديث الصفحة
            </button>
            <button onClick={() => { window.location.href = "/dashboard"; }}
              style={{ background: "transparent", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", padding: "0.625rem 1.5rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>
              العودة للرئيسية
            </button>
          </div>
          <div style={{
            padding: "0.5rem 1rem", borderRadius: "0.375rem",
            background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
            fontFamily: "monospace", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))",
            direction: "ltr",
          }}>
            {errorId}
          </div>
          {import.meta.env.DEV && (
            <pre style={{ color: "hsl(var(--destructive))", fontSize: "0.75rem", maxWidth: "600px", overflow: "auto", background: "hsl(var(--muted))", padding: "1rem", borderRadius: "0.5rem", textAlign: "start" }}>
              {error.message}{"\n"}{error.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Clerk cache invalidator ────────────────────────────────────────────────────
// On user change (login / logout / office switch):
//   1. Remove queries whose key contains the old userId (tenant-scoped data)
//   2. Invalidate shared queries so they re-fetch fresh for the new user
//   3. Public/shared queries (landing, plans, cms) are intentionally kept
function ClerkQueryClientCacheInvalidator() {
  const clerk = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!clerk?.addListener) return;
    const unsubscribe = clerk.addListener(({ user }) => {
      const nextUserId = user?.id ?? null;
      const prevUserId = prevUserIdRef.current;

      if (prevUserId !== undefined && prevUserId !== nextUserId) {
        // Selective removal: purge only queries that are user/office-scoped.
        // Keys that are arrays whose first element is a user-specific string,
        // or string keys that contain the previous userId.
        qc.removeQueries({
          predicate: (query) => {
            const key = query.queryKey;
            // Keep public/shared queries (landing, plans, cms variants)
            const publicKeys = ["landing-variant-public", "home-cms", "pricing-plans"];
            if (Array.isArray(key) && publicKeys.includes(key[0] as string)) return false;
            // Remove everything user-specific
            return true;
          },
        });
        // Also invalidate remaining shared queries so they re-fetch
        qc.invalidateQueries({ refetchType: "none" });
      }
      prevUserIdRef.current = nextUserId;
    });
    return unsubscribe;
  }, [clerk, qc]);

  return null;
}

// ── Smart redirect: sends each role to its own world ───────────────────────────
function RoleAwareRedirect() {
  const { role, isLoaded } = useRole();
  if (!isLoaded) return <PageLoader />;
  if (role === "platform_admin") return <Redirect to="/super-admin" />;
  return <Redirect to="/dashboard" />;
}

// ── Home redirect ──────────────────────────────────────────────────────────────
// Production-grade: Landing renders immediately regardless of Clerk state.
// Clerk hanging/failing/slow never causes a blank screen.
function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();

  // Clerk still initializing OR signed out → show Landing immediately
  // Landing is eagerly imported so there is no Suspense/lazy delay → no blue flash
  if (!isLoaded || !isSignedIn) {
    return <Landing />;
  }

  // Clerk ready + signed in → go to their dashboard
  return <RoleAwareRedirect />;
}

// ── Onboarding gate ────────────────────────────────────────────────────────────
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const skip = location === "/onboarding";

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetch(`${basePath}/api/onboarding/state`).then(r => r.json()),
    staleTime: 10 * 60 * 1000,
    retry: false,
    enabled: !skip,
  });

  if (!skip && !isLoading && data && data.completed === false && data.step === 0) {
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}

// ── Platform Admin route ────────────────────────────────────────────────────────
// Only platform_admin can enter — others go to /dashboard
// Uses useAuth directly so Clerk loading state never produces a blank screen
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { role } = useRole();

  if (!isLoaded)    return <PageLoader />;
  if (!isSignedIn)  return <Redirect to="/" />;
  if (role !== "platform_admin") return <Redirect to="/dashboard" />;

  return (
    <AdminLayout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </AdminLayout>
  );
}

// ── Workspace route ─────────────────────────────────────────────────────────────
// Law firm users only — platform_admin is redirected to their own world
function WorkspaceRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { role } = useRole();

  if (!isLoaded)   return <PageLoader />;
  if (!isSignedIn) return <Redirect to="/" />;
  if (role === "platform_admin") return <Redirect to="/super-admin" />;

  return (
    <OnboardingGate>
      <Layout>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </Layout>
    </OnboardingGate>
  );
}

// ── Protected route wrapper ────────────────────────────────────────────────────
// Generic — any authenticated user (both roles can access)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded)   return <PageLoader />;
  if (!isSignedIn) return <Redirect to="/" />;

  return (
    <OnboardingGate>
      <Layout>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </Layout>
    </OnboardingGate>
  );
}

// ── Role-protected route — requires a specific RBAC permission ─────────────────
// Redirects to /dashboard if the user lacks the required permission.
// Waits for both Clerk + permissions to load before deciding (never grants early access).
function RoleRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { hasPermission, isLoaded: permLoaded } = usePermissions();

  if (!isLoaded || !permLoaded) return <PageLoader />;
  if (!isSignedIn)              return <Redirect to="/" />;
  if (!hasPermission(permission)) return <Redirect to="/dashboard" />;

  return (
    <OnboardingGate>
      <Layout>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </Layout>
    </OnboardingGate>
  );
}

// ── Public route with Suspense ─────────────────────────────────────────────────
function PublicPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// ── All routes (inside ClerkProvider — auth-aware) ─────────────────────────────
function AppRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={`${basePath}/dashboard`}
      signUpFallbackRedirectUrl={`${basePath}/dashboard`}
      localization={{
        signIn: { start: { title: "مرحباً بعودتك", subtitle: "سجّل دخولك إلى منصة عدالة AI" } },
        signUp: { start: { title: "انضم إلى عدالة AI", subtitle: "أنشئ حسابك وابدأ الآن" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <OfficeThemeProvider />
      <AppErrorBoundary>
          <Switch>
            {/* ── Public ── */}
            <Route path="/" component={HomeRedirect} />
            <Route path="/pricing"><PublicPage><PricingPage /></PublicPage></Route>
            <Route path="/demo"><PublicPage><DemoPage /></PublicPage></Route>
            <Route path="/demo-login"><Suspense fallback={<PageLoader />}><DemoLoginPage /></Suspense></Route>
            <Route path="/live-demo"><Suspense fallback={<PageLoader />}><LiveDemoPage /></Suspense></Route>
            <Route path="/terms"><PublicPage><TermsPage /></PublicPage></Route>
            <Route path="/privacy"><PublicPage><PrivacyPage /></PublicPage></Route>
            <Route path="/security"><PublicPage><SecurityPage /></PublicPage></Route>
            <Route path="/referral"><PublicPage><ReferralPage /></PublicPage></Route>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/onboarding"><PublicPage><OnboardingPage /></PublicPage></Route>

            {/* ── Portal (public, before /:token catch-all) ── */}
            <Route path="/sign/:token">{({ token }: { token: string }) => <PublicPage><SignPage token={token} /></PublicPage>}</Route>
            <Route path="/invoice/:token">{(p: any) => <Suspense fallback={<PageLoader />}><InvoicePublic token={p.token} /></Suspense>}</Route>
            <Route path="/portal/login"><PublicPage><PortalLogin /></PublicPage></Route>
            <Route path="/portal/my-cases"><PublicPage><PortalMyCases /></PublicPage></Route>
            <Route path="/portal/:token"><PublicPage><PortalView /></PublicPage></Route>

            {/* ── Public firm pages ── */}
            <Route path="/firms/:slug/login"><PublicPage><OfficeLogin /></PublicPage></Route>
            <Route path="/firms/:slug/store"><PublicPage><OfficeStore /></PublicPage></Route>
            <Route path="/firms/:slug/bankruptcy"><PublicPage><OfficeBankruptcy /></PublicPage></Route>
            <Route path="/firms/:slug/book"><PublicPage><OfficeBook /></PublicPage></Route>
            <Route path="/firms/:slug/service/:serviceId"><PublicPage><OfficeServiceDetail /></PublicPage></Route>
            <Route path="/firms/:slug"><PublicPage><OfficePage /></PublicPage></Route>

            {/* ── Workspace (law firm users only) ── */}
            <Route path="/dashboard"><WorkspaceRoute><Dashboard /></WorkspaceRoute></Route>

            {/* Cases */}
            <Route path="/cases"><WorkspaceRoute><Cases /></WorkspaceRoute></Route>
            <Route path="/cases/:id">{p => <WorkspaceRoute><CaseDetail id={p.id} /></WorkspaceRoute>}</Route>
            <Route path="/hearings-calendar"><WorkspaceRoute><HearingsCalendar /></WorkspaceRoute></Route>

            {/* Clients */}
            <Route path="/clients"><WorkspaceRoute><Clients /></WorkspaceRoute></Route>
            <Route path="/clients/:id"><WorkspaceRoute><ClientDetail /></WorkspaceRoute></Route>

            {/* Documents */}
            <Route path="/documents"><ProtectedRoute><Documents /></ProtectedRoute></Route>
            <Route path="/contracts"><ProtectedRoute><Contracts /></ProtectedRoute></Route>
            <Route path="/letters"><ProtectedRoute><Letters /></ProtectedRoute></Route>
            <Route path="/warnings"><ProtectedRoute><Warnings /></ProtectedRoute></Route>
            <Route path="/document-templates"><ProtectedRoute><DocumentTemplatesPage /></ProtectedRoute></Route>

            {/* AI */}
            <Route path="/ai-tasks"><ProtectedRoute><AiTasks /></ProtectedRoute></Route>
            <Route path="/ai-coo"><ProtectedRoute><AiCooPage /></ProtectedRoute></Route>
            <Route path="/ai-hub"><ProtectedRoute><AIHub /></ProtectedRoute></Route>
            <Route path="/ai-router"><ProtectedRoute><AIRouterDashboard /></ProtectedRoute></Route>
            <Route path="/ai-copilot"><Redirect to={`${basePath}/ai-hub`} /></Route>
            <Route path="/adoul"><Redirect to={`${basePath}/ai-hub`} /></Route>
            <Route path="/ai-chat"><Redirect to={`${basePath}/ai-hub`} /></Route>
            <Route path="/ai-agents"><Redirect to={`${basePath}/ai-hub`} /></Route>
            <Route path="/ai-assistant"><Redirect to={`${basePath}/ai-hub`} /></Route>
            <Route path="/opponent-simulator"><ProtectedRoute><OpponentSimulator /></ProtectedRoute></Route>
            <Route path="/command-center"><ProtectedRoute><CommandCenter /></ProtectedRoute></Route>
            <Route path="/legal-ai"><ProtectedRoute><LegalAIPage /></ProtectedRoute></Route>

            {/* JLWM Phase 1 */}
            <Route path="/jlwm"><ProtectedRoute><JLWMDashboard /></ProtectedRoute></Route>
            <Route path="/jlwm/world-state"><ProtectedRoute><JLWMWorldState /></ProtectedRoute></Route>
            <Route path="/jlwm/memory-graph"><ProtectedRoute><JLWMMemoryGraph /></ProtectedRoute></Route>
            <Route path="/jlwm/command"><ProtectedRoute><JLWMCommandCenter /></ProtectedRoute></Route>
            {/* JLWM Phase 2 — Predictive Intelligence */}
            <Route path="/jlwm/predictions"><ProtectedRoute><JLWMPredictions /></ProtectedRoute></Route>
            <Route path="/jlwm/future-explorer"><ProtectedRoute><JLWMFutureExplorer /></ProtectedRoute></Route>
            <Route path="/jlwm/simulation"><ProtectedRoute><JLWMSimulation /></ProtectedRoute></Route>
            <Route path="/jlwm/litigation-intelligence"><ProtectedRoute><JLWMLitigationIntel /></ProtectedRoute></Route>
            {/* JLWM Phase 3 — Validation & Executive Intelligence */}
            <Route path="/jlwm/prediction-accuracy"><ProtectedRoute><JLWMPredictionAccuracy /></ProtectedRoute></Route>
            <Route path="/jlwm/executive-intelligence"><ProtectedRoute><JLWMExecutiveIntel /></ProtectedRoute></Route>
            <Route path="/jlwm/legal-coo"><ProtectedRoute><JLWMLegalCOO /></ProtectedRoute></Route>
            <Route path="/jlwm/reliability"><ProtectedRoute><JLWMReliability /></ProtectedRoute></Route>
            {/* JLWM Phase 4 — Enterprise */}
            <Route path="/jlwm/enterprise"><ProtectedRoute><JLWMEnterpriseReport /></ProtectedRoute></Route>

            {/* Legal & Research */}
            <Route path="/legal-research"><ProtectedRoute><LegalResearch /></ProtectedRoute></Route>
            <Route path="/arbitration"><ProtectedRoute><Arbitration /></ProtectedRoute></Route>
            <Route path="/judge-prep"><ProtectedRoute><JudgePrep /></ProtectedRoute></Route>
            <Route path="/saudi-systems"><ProtectedRoute><SaudiSystems /></ProtectedRoute></Route>
            <Route path="/mediators"><ProtectedRoute><MediatorsPage /></ProtectedRoute></Route>
            <Route path="/risk-management"><ProtectedRoute><RiskManagement /></ProtectedRoute></Route>
            <Route path="/compliance"><ProtectedRoute><Compliance /></ProtectedRoute></Route>

            {/* Finance */}
            <Route path="/invoices"><ProtectedRoute><Invoices /></ProtectedRoute></Route>
            <Route path="/revenues"><ProtectedRoute><Revenues /></ProtectedRoute></Route>
            <Route path="/expenses"><ProtectedRoute><Expenses /></ProtectedRoute></Route>
            <Route path="/financial-reports"><ProtectedRoute><FinancialReports /></ProtectedRoute></Route>
            <Route path="/tax-settings"><ProtectedRoute><TaxSettings /></ProtectedRoute></Route>
            <Route path="/financial-statements"><ProtectedRoute><FinancialStatements /></ProtectedRoute></Route>
            <Route path="/ui-builder"><ProtectedRoute><UIBuilder /></ProtectedRoute></Route>
            <Route path="/cashflow"><ProtectedRoute><Cashflow /></ProtectedRoute></Route>
            <Route path="/bank-accounts"><ProtectedRoute><BankAccounts /></ProtectedRoute></Route>
            <Route path="/advances"><ProtectedRoute><Advances /></ProtectedRoute></Route>
            <Route path="/payment-center"><ProtectedRoute><PaymentCenter /></ProtectedRoute></Route>
            <Route path="/finance"><ProtectedRoute><FinanceCenter /></ProtectedRoute></Route>
            <Route path="/collections"><ProtectedRoute><Collections /></ProtectedRoute></Route>
            <Route path="/financial-intelligence"><ProtectedRoute><FinancialIntelligence /></ProtectedRoute></Route>

            {/* HR */}
            <Route path="/employees"><ProtectedRoute><Employees /></ProtectedRoute></Route>
            <Route path="/attendance"><ProtectedRoute><Attendance /></ProtectedRoute></Route>
            <Route path="/leaves"><ProtectedRoute><Leaves /></ProtectedRoute></Route>
            <Route path="/payroll"><RoleRoute permission="payroll:view"><Payroll /></RoleRoute></Route>
            <Route path="/hr-center"><ProtectedRoute><HRCenter /></ProtectedRoute></Route>
            <Route path="/hr-enterprise"><ProtectedRoute><HREnterprise /></ProtectedRoute></Route>
            <Route path="/hr-systems"><ProtectedRoute><HRSystems /></ProtectedRoute></Route>
            <Route path="/branches"><ProtectedRoute><BranchesPage /></ProtectedRoute></Route>
            <Route path="/org-structure"><ProtectedRoute><OrgStructure /></ProtectedRoute></Route>

            {/* Analytics & Calendar */}
            <Route path="/analytics"><ProtectedRoute><Analytics /></ProtectedRoute></Route>
            <Route path="/tasks"><ProtectedRoute><Tasks /></ProtectedRoute></Route>
            <Route path="/calendar"><ProtectedRoute><CalendarPage /></ProtectedRoute></Route>

            {/* ── Platform Admin (platform_admin only) ── */}
            <Route path="/super-admin"><AdminRoute><SuperAdmin /></AdminRoute></Route>
            <Route path="/studio"><AdminRoute><AdalaBuildStudio /></AdminRoute></Route>
            <Route path="/financial-core"><AdminRoute><FinancialCore /></AdminRoute></Route>
            <Route path="/audit-logs"><AdminRoute><AuditLogsPage /></AdminRoute></Route>
            <Route path="/soc"><AdminRoute><SOCPage /></AdminRoute></Route>
            <Route path="/audit-center"><AdminRoute><AuditCenterPage /></AdminRoute></Route>
            <Route path="/executive-dashboard"><AdminRoute><ExecutiveDashboard /></AdminRoute></Route>
            <Route path="/engineering-center"><AdminRoute><EngineeringCenter /></AdminRoute></Route>
            <Route path="/ai-command-center"><AdminRoute><AICommandCenter /></AdminRoute></Route>
            <Route path="/ai-workflow-builder"><ProtectedRoute><AIWorkflowBuilder /></ProtectedRoute></Route>
            <Route path="/production-os"><AdminRoute><ProductionOSPage /></AdminRoute></Route>
            <Route path="/control-tower"><AdminRoute><ControlTowerPage /></AdminRoute></Route>
            <Route path="/saas-os"><AdminRoute><SaasOSPage /></AdminRoute></Route>
            <Route path="/commercial-launch"><AdminRoute><CommercialLaunchPage /></AdminRoute></Route>
            <Route path="/monitoring"><AdminRoute><MonitoringPage /></AdminRoute></Route>
            <Route path="/prevention"><AdminRoute><PreventionPage /></AdminRoute></Route>
            <Route path="/alerts"><AdminRoute><AlertsPage /></AdminRoute></Route>
            <Route path="/financial-engine"><AdminRoute><FinancialEnginePage /></AdminRoute></Route>
            <Route path="/enterprise-finance"><ProtectedRoute><EnterpriseFinance /></ProtectedRoute></Route>
            <Route path="/finance-dashboard"><AdminRoute><FinanceDashboard /></AdminRoute></Route>
            <Route path="/isolation"><AdminRoute><IsolationPage /></AdminRoute></Route>
            <Route path="/hardening"><AdminRoute><HardeningPage /></AdminRoute></Route>
            <Route path="/zero-trust"><AdminRoute><ZeroTrustShieldPage /></AdminRoute></Route>
            <Route path="/launch-gate"><AdminRoute><LaunchGatePage /></AdminRoute></Route>
            <Route path="/production-launch"><AdminRoute><ProductionLaunchCenter /></AdminRoute></Route>
            <Route path="/legal-os"><ProtectedRoute><LegalOSPage /></ProtectedRoute></Route>
            <Route path="/self-healing"><AdminRoute><SelfHealingPage /></AdminRoute></Route>
            <Route path="/activity-stream"><WorkspaceRoute><ActivityStreamPage /></WorkspaceRoute></Route>

            {/* Admin & Settings (law firm admins) */}
            <Route path="/users"><RoleRoute permission="users:view"><Users /></RoleRoute></Route>
            <Route path="/team"><ProtectedRoute><Team /></ProtectedRoute></Route>
            <Route path="/office-settings"><ProtectedRoute><OfficeSettings /></ProtectedRoute></Route>
            <Route path="/office-management"><ProtectedRoute><OfficeManagement /></ProtectedRoute></Route>
            <Route path="/website-builder"><ProtectedRoute><WebsiteBuilder /></ProtectedRoute></Route>
            <Route path="/storage-settings"><ProtectedRoute><StorageSettings /></ProtectedRoute></Route>
            <Route path="/document-center"><ProtectedRoute><DocumentCenter /></ProtectedRoute></Route>
            <Route path="/firm-admin"><ProtectedRoute><FirmAdmin /></ProtectedRoute></Route>
            <Route path="/backup"><ProtectedRoute><BackupCenter /></ProtectedRoute></Route>
            <Route path="/theme-builder"><ProtectedRoute><ThemeBuilderPage /></ProtectedRoute></Route>
            <Route path="/login-tracking"><ProtectedRoute><LoginTrackingPage /></ProtectedRoute></Route>
            <Route path="/my-sessions"><ProtectedRoute><MySessionsPage /></ProtectedRoute></Route>
            <Route path="/my-profile"><ProtectedRoute><MyProfilePage /></ProtectedRoute></Route>

            {/* Communication */}
            <Route path="/messages"><ProtectedRoute><Messages /></ProtectedRoute></Route>
            <Route path="/reminders"><ProtectedRoute><RemindersPage /></ProtectedRoute></Route>
            <Route path="/bankruptcy"><ProtectedRoute><BankruptcyPage /></ProtectedRoute></Route>
            <Route path="/email-notifications"><ProtectedRoute><EmailNotificationsPage /></ProtectedRoute></Route>
            <Route path="/whatsapp-settings"><ProtectedRoute><WhatsAppSettingsPage /></ProtectedRoute></Route>
            <Route path="/telegram-settings"><ProtectedRoute><TelegramSettingsPage /></ProtectedRoute></Route>
            <Route path="/notification-settings"><ProtectedRoute><NotificationSettingsPage /></ProtectedRoute></Route>
            <Route path="/support"><ProtectedRoute><SupportPage /></ProtectedRoute></Route>
            <Route path="/integrations"><ProtectedRoute><Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense></ProtectedRoute></Route>

            {/* Portal & Marketplace */}
            <Route path="/client-portal"><ProtectedRoute><ClientPortal /></ProtectedRoute></Route>
            <Route path="/marketplace"><ProtectedRoute><Marketplace /></ProtectedRoute></Route>
            <Route path="/billing"><ProtectedRoute><Billing /></ProtectedRoute></Route>
            <Route path="/upgrade"><ProtectedRoute><Suspense fallback={<PageLoader />}><UpgradePage /></Suspense></ProtectedRoute></Route>

            {/* Security */}
            <Route path="/2fa-setup"><ProtectedRoute><TwoFactorSetup /></ProtectedRoute></Route>
            <Route path="/2fa-verify"><PublicPage><TwoFactorVerify /></PublicPage></Route>

            {/* Public Status Page */}
            <Route path="/system-status"><SystemStatusPage /></Route>

            {/* 404 */}
            <Route><Layout><Suspense fallback={<PageLoader />}><NotFound /></Suspense></Layout></Route>
          </Switch>
        </AppErrorBoundary>
    </ClerkProvider>
  );
}

// ── Public home — renders Landing instantly, zero ClerkProvider dependency ─────
function HomeLanding() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0F1B35" }} />}>
      <Landing />
    </Suspense>
  );
}

// ── App root ───────────────────────────────────────────────────────────────────
// QueryClientProvider + TooltipProvider live here (OUTSIDE ClerkProvider) so
// Landing at "/" can use useQuery without waiting for Clerk to initialise.
function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div dir="rtl" className="font-sans antialiased text-foreground bg-background min-h-screen w-full" style={{ overflowX: "hidden", maxWidth: "100vw" }}>
            <WouterRouter base={basePath}>
              <Switch>
                {/* "/" → Landing renders immediately — no Clerk dependency */}
                <Route path="/" component={HomeLanding} />
                {/* All other routes go through ClerkProvider */}
                <Route>
                  <AppRoutes />
                </Route>
              </Switch>
              <Toaster />
            </WouterRouter>
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
