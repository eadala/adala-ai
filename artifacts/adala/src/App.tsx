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
import { OfficeThemeProvider } from "@/components/office-theme-provider";

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
// Core (likely first visit)
const Dashboard            = lazy(() => import("@/pages/dashboard"));
// Landing is eagerly imported above — do NOT add it here
const OnboardingPage       = lazy(() => import("@/pages/platform/onboarding"));

// Cases & Clients
const Cases                = lazy(() => import("@/pages/legal-core/cases"));
const CaseDetail           = lazy(() => import("@/pages/legal-core/case-detail"));
const Clients              = lazy(() => import("@/pages/legal-core/clients"));
const ClientDetail         = lazy(() => import("@/pages/legal-core/client-detail"));
const Contracts            = lazy(() => import("@/pages/legal-core/contracts"));

// Documents & Files
const Documents            = lazy(() => import("@/pages/legal-core/documents"));
const Letters              = lazy(() => import("@/pages/legal-core/letters"));
const Warnings             = lazy(() => import("@/pages/legal-core/warnings"));

// AI Suite
const AiTasks              = lazy(() => import("@/pages/ai/ai-tasks"));
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
const Revenues             = lazy(() => import("@/pages/financial/revenues"));
const Expenses             = lazy(() => import("@/pages/financial/expenses"));
const FinancialReports     = lazy(() => import("@/pages/financial/financial-reports"));
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
const SuperAdmin           = lazy(() => import("@/pages/platform/super-admin"));
const FirmAdmin            = lazy(() => import("@/pages/platform/firm-admin"));
const BackupCenter         = lazy(() => import("@/pages/platform/backup"));
const StorageSettings      = lazy(() => import("@/pages/platform/storage-settings"));
const AdalaBuildStudio     = lazy(() => import("@/pages/platform/studio"));
const ThemeBuilderPage     = lazy(() => import("@/pages/platform/theme-builder"));
const EngineeringCenter    = lazy(() => import("@/pages/platform/engineering-center"));
const AICommandCenter      = lazy(() => import("@/pages/platform/ai-command-center"));
const MonitoringPage       = lazy(() => import("@/pages/monitoring/monitoring"));
const PreventionPage       = lazy(() => import("@/pages/monitoring/prevention"));
const AlertsPage           = lazy(() => import("@/pages/monitoring/alerts"));
const FinancialEnginePage  = lazy(() => import("@/pages/financial/financial-engine"));
const FinanceDashboard     = lazy(() => import("@/pages/financial/finance-dashboard"));
const IsolationPage        = lazy(() => import("@/pages/monitoring/isolation"));
const HardeningPage        = lazy(() => import("@/pages/monitoring/hardening"));
const ZeroTrustShieldPage  = lazy(() => import("@/pages/platform/zero-trust-shield"));
const LegalOSPage          = lazy(() => import("@/pages/legal-core/legal-os"));
const SelfHealingPage      = lazy(() => import("@/pages/monitoring/self-healing"));
const AuditLogsPage        = lazy(() => import("@/pages/platform/audit-logs"));
const LoginTrackingPage    = lazy(() => import("@/pages/platform/login-tracking"));
const MySessionsPage       = lazy(() => import("@/pages/platform/my-sessions"));
const MyProfilePage        = lazy(() => import("@/pages/my-profile"));
const ActivityStreamPage   = lazy(() => import("@/pages/monitoring/activity-stream"));

// Communication
const Messages             = lazy(() => import("@/pages/operations/messages"));
const RemindersPage        = lazy(() => import("@/pages/legal-core/reminders"));
const EmailNotificationsPage = lazy(() => import("@/pages/operations/email-notifications"));
const WhatsAppSettingsPage  = lazy(() => import("@/pages/operations/whatsapp-settings"));
const TelegramSettingsPage  = lazy(() => import("@/pages/operations/telegram-settings"));
const DocumentTemplatesPage = lazy(() => import("@/pages/legal-core/document-templates"));
const SupportPage          = lazy(() => import("@/pages/platform/support"));

// Analytics & Reports
const Analytics            = lazy(() => import("@/pages/operations/analytics"));
const Tasks                = lazy(() => import("@/pages/operations/tasks"));
const CalendarPage         = lazy(() => import("@/pages/operations/calendar"));

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
const OfficeBook           = lazy(() => import("@/pages/marketplace/office-book"));
const OfficeLogin          = lazy(() => import("@/pages/marketplace/office-login"));
const TermsPage            = lazy(() => import("@/pages/terms"));
const PrivacyPage          = lazy(() => import("@/pages/privacy"));
const SecurityPage         = lazy(() => import("@/pages/security"));
const ReferralPage         = lazy(() => import("@/pages/marketplace/referral"));
const NotFound             = lazy(() => import("@/pages/not-found"));

// ── Query client ───────────────────────────────────────────────────────────────
// staleTime=5min: data is fresh for 5 minutes, no duplicate network calls
// gcTime=30min: cached data stays in memory for 30 minutes after last use
// refetchOnWindowFocus=false: tab switching doesn't trigger floods of requests
// retry=1: fail fast on bad routes, don't spam the server
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
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

// ── Auth pages ─────────────────────────────────────────────────────────────────
function SignInPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 gap-6" style={{ background: "linear-gradient(135deg, #0F1B35 0%, #1A2744 50%, #0F1B35 100%)" }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/dashboard`} />
      <div className="w-full max-w-sm" dir="rtl">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30 whitespace-nowrap">أو جرّب بدون تسجيل</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <a href={`${basePath}/demo-login`} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-all text-white text-sm font-bold hover:scale-[1.01]">
          <span className="text-base">🧪</span>
          دخول تجريبي سريع — بدون حساب
        </a>
        <p className="text-center text-xs text-white/20 mt-2">مكاتب تجريبية جاهزة · بيانات معزولة · كل الميزات مفتوحة</p>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0F1B35 0%, #1A2744 50%, #0F1B35 100%)" }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/dashboard`} />
    </div>
  );
}

// ── Root error boundary ────────────────────────────────────────────────────────
// Catches any render-time throw in the app tree and shows a recoverable message
// instead of a completely blank white screen.
interface EBState { error: Error | null }
class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Adala] AppErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" style={{ padding: "2rem", fontFamily: "Cairo, sans-serif", background: "#0F1B35", minHeight: "100vh", color: "#F8F9FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
          <div style={{ fontSize: "2rem" }}>⚠️</div>
          <h1 style={{ color: "#2563EB", fontSize: "1.25rem" }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: "#A0ADB8", fontSize: "0.875rem" }}>يرجى تحديث الصفحة. إذا استمرت المشكلة، تواصل مع الدعم.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#2563EB", color: "#1A2744", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "bold" }}
          >
            تحديث الصفحة
          </button>
          {import.meta.env.DEV && (
            <pre style={{ color: "#EF4444", fontSize: "0.75rem", maxWidth: "600px", overflow: "auto", background: "#1A2744", padding: "1rem", borderRadius: "0.5rem" }}>
              {this.state.error.message}{"\n"}{this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Clerk cache invalidator ────────────────────────────────────────────────────
// Safe: guards against useClerk() returning undefined when Clerk singleton
// is not yet ready (e.g. ClerkProvider still initializing in production).
function ClerkQueryClientCacheInvalidator() {
  const clerk = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!clerk?.addListener) return;
    const unsubscribe = clerk.addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
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
            <Route path="/portal/login"><PublicPage><PortalLogin /></PublicPage></Route>
            <Route path="/portal/my-cases"><PublicPage><PortalMyCases /></PublicPage></Route>
            <Route path="/portal/:token"><PublicPage><PortalView /></PublicPage></Route>

            {/* ── Public firm pages ── */}
            <Route path="/firms/:slug/login"><PublicPage><OfficeLogin /></PublicPage></Route>
            <Route path="/firms/:slug/store"><PublicPage><OfficeStore /></PublicPage></Route>
            <Route path="/firms/:slug/book"><PublicPage><OfficeBook /></PublicPage></Route>
            <Route path="/firms/:slug/service/:serviceId"><PublicPage><OfficeServiceDetail /></PublicPage></Route>
            <Route path="/firms/:slug"><PublicPage><OfficePage /></PublicPage></Route>

            {/* ── Workspace (law firm users only) ── */}
            <Route path="/dashboard"><WorkspaceRoute><Dashboard /></WorkspaceRoute></Route>

            {/* Cases */}
            <Route path="/cases"><WorkspaceRoute><Cases /></WorkspaceRoute></Route>
            <Route path="/cases/:id">{p => <WorkspaceRoute><CaseDetail id={p.id} /></WorkspaceRoute>}</Route>

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
            <Route path="/ai-hub"><ProtectedRoute><AIHub /></ProtectedRoute></Route>
            <Route path="/ai-copilot"><ProtectedRoute><AICopilotPage /></ProtectedRoute></Route>
            <Route path="/adoul"><ProtectedRoute><AdoulPage /></ProtectedRoute></Route>
            <Route path="/ai-chat"><ProtectedRoute><AiChat /></ProtectedRoute></Route>
            <Route path="/opponent-simulator"><ProtectedRoute><OpponentSimulator /></ProtectedRoute></Route>
            <Route path="/ai-agents"><ProtectedRoute><AiAgents /></ProtectedRoute></Route>
            <Route path="/command-center"><ProtectedRoute><CommandCenter /></ProtectedRoute></Route>
            <Route path="/legal-ai"><ProtectedRoute><LegalAIPage /></ProtectedRoute></Route>
            <Route path="/ai-assistant"><ProtectedRoute><AIAssistant /></ProtectedRoute></Route>

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
            <Route path="/payroll"><ProtectedRoute><Payroll /></ProtectedRoute></Route>
            <Route path="/hr-center"><ProtectedRoute><HRCenter /></ProtectedRoute></Route>
            <Route path="/hr-enterprise"><ProtectedRoute><HREnterprise /></ProtectedRoute></Route>
            <Route path="/hr-systems"><ProtectedRoute><HRSystems /></ProtectedRoute></Route>
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
            <Route path="/engineering-center"><AdminRoute><EngineeringCenter /></AdminRoute></Route>
            <Route path="/ai-command-center"><AdminRoute><AICommandCenter /></AdminRoute></Route>
            <Route path="/monitoring"><AdminRoute><MonitoringPage /></AdminRoute></Route>
            <Route path="/prevention"><AdminRoute><PreventionPage /></AdminRoute></Route>
            <Route path="/alerts"><AdminRoute><AlertsPage /></AdminRoute></Route>
            <Route path="/financial-engine"><AdminRoute><FinancialEnginePage /></AdminRoute></Route>
            <Route path="/enterprise-finance"><ProtectedRoute><EnterpriseFinance /></ProtectedRoute></Route>
            <Route path="/finance-dashboard"><AdminRoute><FinanceDashboard /></AdminRoute></Route>
            <Route path="/isolation"><AdminRoute><IsolationPage /></AdminRoute></Route>
            <Route path="/hardening"><AdminRoute><HardeningPage /></AdminRoute></Route>
            <Route path="/zero-trust"><AdminRoute><ZeroTrustShieldPage /></AdminRoute></Route>
            <Route path="/legal-os"><ProtectedRoute><LegalOSPage /></ProtectedRoute></Route>
            <Route path="/self-healing"><AdminRoute><SelfHealingPage /></AdminRoute></Route>
            <Route path="/activity-stream"><WorkspaceRoute><ActivityStreamPage /></WorkspaceRoute></Route>

            {/* Admin & Settings (law firm admins) */}
            <Route path="/users"><ProtectedRoute><Users /></ProtectedRoute></Route>
            <Route path="/team"><ProtectedRoute><Team /></ProtectedRoute></Route>
            <Route path="/office-settings"><ProtectedRoute><OfficeSettings /></ProtectedRoute></Route>
            <Route path="/office-management"><ProtectedRoute><OfficeManagement /></ProtectedRoute></Route>
            <Route path="/storage-settings"><ProtectedRoute><StorageSettings /></ProtectedRoute></Route>
            <Route path="/firm-admin"><ProtectedRoute><FirmAdmin /></ProtectedRoute></Route>
            <Route path="/backup"><ProtectedRoute><BackupCenter /></ProtectedRoute></Route>
            <Route path="/theme-builder"><ProtectedRoute><ThemeBuilderPage /></ProtectedRoute></Route>
            <Route path="/login-tracking"><ProtectedRoute><LoginTrackingPage /></ProtectedRoute></Route>
            <Route path="/my-sessions"><ProtectedRoute><MySessionsPage /></ProtectedRoute></Route>
            <Route path="/my-profile"><ProtectedRoute><MyProfilePage /></ProtectedRoute></Route>

            {/* Communication */}
            <Route path="/messages"><ProtectedRoute><Messages /></ProtectedRoute></Route>
            <Route path="/reminders"><ProtectedRoute><RemindersPage /></ProtectedRoute></Route>
            <Route path="/email-notifications"><ProtectedRoute><EmailNotificationsPage /></ProtectedRoute></Route>
            <Route path="/whatsapp-settings"><ProtectedRoute><WhatsAppSettingsPage /></ProtectedRoute></Route>
            <Route path="/telegram-settings"><ProtectedRoute><TelegramSettingsPage /></ProtectedRoute></Route>
            <Route path="/support"><ProtectedRoute><SupportPage /></ProtectedRoute></Route>

            {/* Portal & Marketplace */}
            <Route path="/client-portal"><ProtectedRoute><ClientPortal /></ProtectedRoute></Route>
            <Route path="/marketplace"><ProtectedRoute><Marketplace /></ProtectedRoute></Route>
            <Route path="/billing"><ProtectedRoute><Billing /></ProtectedRoute></Route>
            <Route path="/upgrade"><ProtectedRoute><Suspense fallback={<PageLoader />}><UpgradePage /></Suspense></ProtectedRoute></Route>

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
