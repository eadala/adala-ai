import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
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
const Landing              = lazy(() => import("@/pages/landing"));
const OnboardingPage       = lazy(() => import("@/pages/onboarding"));

// Cases & Clients
const Cases                = lazy(() => import("@/pages/cases"));
const CaseDetail           = lazy(() => import("@/pages/case-detail"));
const Clients              = lazy(() => import("@/pages/clients"));
const ClientDetail         = lazy(() => import("@/pages/client-detail"));
const Contracts            = lazy(() => import("@/pages/contracts"));

// Documents & Files
const Documents            = lazy(() => import("@/pages/documents"));
const Letters              = lazy(() => import("@/pages/letters"));
const Warnings             = lazy(() => import("@/pages/warnings"));

// AI Suite
const AiTasks              = lazy(() => import("@/pages/ai-tasks"));
const AIHub                = lazy(() => import("@/pages/ai-hub"));
const AiChat               = lazy(() => import("@/pages/ai-chat"));
const OpponentSimulator    = lazy(() => import("@/pages/opponent-simulator"));
const AiAgents             = lazy(() => import("@/pages/ai-agents"));
const CommandCenter        = lazy(() => import("@/pages/command-center"));
const LegalAIPage          = lazy(() => import("@/pages/legal-ai"));
const AIAssistant          = lazy(() => import("@/pages/ai-assistant"));

// Legal & Research
const LegalResearch        = lazy(() => import("@/pages/legal-research"));
const Arbitration          = lazy(() => import("@/pages/arbitration"));
const JudgePrep            = lazy(() => import("@/pages/judge-prep"));
const SaudiSystems         = lazy(() => import("@/pages/saudi-systems"));
const MediatorsPage        = lazy(() => import("@/pages/mediators"));
const RiskManagement       = lazy(() => import("@/pages/risk-management"));
const Compliance           = lazy(() => import("@/pages/compliance"));

// Finance & Accounting
const Invoices             = lazy(() => import("@/pages/invoices"));
const Revenues             = lazy(() => import("@/pages/revenues"));
const Expenses             = lazy(() => import("@/pages/expenses"));
const FinancialReports     = lazy(() => import("@/pages/financial-reports"));
const Cashflow             = lazy(() => import("@/pages/cashflow"));
const BankAccounts         = lazy(() => import("@/pages/bank-accounts"));
const Advances             = lazy(() => import("@/pages/advances"));
const PaymentCenter        = lazy(() => import("@/pages/payment-center"));
const FinanceCenter        = lazy(() => import("@/pages/finance-center"));
const Collections          = lazy(() => import("@/pages/collections"));
const FinancialIntelligence = lazy(() => import("@/pages/financial-intelligence"));
const FinancialCore        = lazy(() => import("@/pages/financial-core"));

// HR
const Employees            = lazy(() => import("@/pages/employees"));
const Attendance           = lazy(() => import("@/pages/attendance"));
const Leaves               = lazy(() => import("@/pages/leaves"));
const Payroll              = lazy(() => import("@/pages/payroll"));
const HRCenter             = lazy(() => import("@/pages/hr-center"));
const HRSystems            = lazy(() => import("@/pages/hr-systems"));
const OrgStructure         = lazy(() => import("@/pages/org-structure"));

// Admin & Settings
const Users                = lazy(() => import("@/pages/users"));
const OfficeSettings       = lazy(() => import("@/pages/office-settings"));
const OfficeManagement     = lazy(() => import("@/pages/office-management"));
const SuperAdmin           = lazy(() => import("@/pages/super-admin"));
const FirmAdmin            = lazy(() => import("@/pages/firm-admin"));
const BackupCenter         = lazy(() => import("@/pages/backup"));
const StorageSettings      = lazy(() => import("@/pages/storage-settings"));
const AdalaBuildStudio     = lazy(() => import("@/pages/studio"));
const ThemeBuilderPage     = lazy(() => import("@/pages/theme-builder"));
const AuditLogsPage        = lazy(() => import("@/pages/audit-logs"));
const LoginTrackingPage    = lazy(() => import("@/pages/login-tracking"));
const MySessionsPage       = lazy(() => import("@/pages/my-sessions"));

// Communication
const Messages             = lazy(() => import("@/pages/messages"));
const RemindersPage        = lazy(() => import("@/pages/reminders"));
const EmailNotificationsPage = lazy(() => import("@/pages/email-notifications"));
const WhatsAppSettingsPage  = lazy(() => import("@/pages/whatsapp-settings"));
const TelegramSettingsPage  = lazy(() => import("@/pages/telegram-settings"));
const DocumentTemplatesPage = lazy(() => import("@/pages/document-templates"));
const SupportPage          = lazy(() => import("@/pages/support"));

// Analytics & Reports
const Analytics            = lazy(() => import("@/pages/analytics"));
const Tasks                = lazy(() => import("@/pages/tasks"));
const CalendarPage         = lazy(() => import("@/pages/calendar"));

// Client Portal
const ClientPortal         = lazy(() => import("@/pages/client-portal"));
const PortalView           = lazy(() => import("@/pages/portal-view"));
const PortalLogin          = lazy(() => import("@/pages/portal-login"));
const PortalMyCases        = lazy(() => import("@/pages/portal-my-cases"));
const SignPage              = lazy(() => import("@/pages/sign"));

// Marketplace & Public
const Marketplace          = lazy(() => import("@/pages/marketplace"));
const Billing              = lazy(() => import("@/pages/billing"));
const PricingPage          = lazy(() => import("@/pages/pricing"));
const DemoPage             = lazy(() => import("@/pages/demo"));
const OfficePage           = lazy(() => import("@/pages/office-public"));
const OfficeStore          = lazy(() => import("@/pages/office-store"));
const OfficeBook           = lazy(() => import("@/pages/office-book"));
const TermsPage            = lazy(() => import("@/pages/terms"));
const PrivacyPage          = lazy(() => import("@/pages/privacy"));
const SecurityPage         = lazy(() => import("@/pages/security"));
const ReferralPage         = lazy(() => import("@/pages/referral"));
const NotFound             = lazy(() => import("@/pages/not-found"));

// ── Query client ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

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
    colorPrimary: "#C9A84C",
    colorForeground: "#F8F9FA",
    colorMutedForeground: "#A0ADB8",
    colorDanger: "#EF4444",
    colorBackground: "#1A2744",
    colorInput: "#243058",
    colorInputForeground: "#F8F9FA",
    colorNeutral: "#2D3D6B",
    fontFamily: "'Cairo', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#1A2744] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl border border-[#2D3D6B]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold text-xl",
    headerSubtitle: "text-[#A0ADB8] text-sm",
    socialButtonsBlockButtonText: "text-white",
    formFieldLabel: "text-[#A0ADB8] text-sm",
    footerActionLink: "text-[#C9A84C] hover:text-[#E0C06A]",
    footerActionText: "text-[#A0ADB8]",
    dividerText: "text-[#A0ADB8]",
    identityPreviewEditButton: "text-[#C9A84C]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-white",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "!border-[#2D3D6B] !bg-[#243058] hover:!bg-[#2D3D6B] !text-white",
    formButtonPrimary: "!bg-[#C9A84C] hover:!bg-[#E0C06A] !text-[#1A2744] font-bold",
    formFieldInput: "!bg-[#243058] !border-[#2D3D6B] !text-white placeholder:text-[#A0ADB8]",
    footerAction: "!bg-transparent",
    dividerLine: "!bg-[#2D3D6B]",
    alert: "!bg-[#243058] !border-[#2D3D6B]",
    otpCodeFieldInput: "!bg-[#243058] !border-[#2D3D6B] !text-white",
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
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0F1B35 0%, #1A2744 50%, #0F1B35 100%)" }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0F1B35 0%, #1A2744 50%, #0F1B35 100%)" }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

// ── Clerk cache invalidator ────────────────────────────────────────────────────
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

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
function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <RoleAwareRedirect />
      </Show>
      <Show when="signed-out">
        <Suspense fallback={<div className="min-h-screen bg-[#0F1B35]" />}>
          <Landing />
        </Suspense>
      </Show>
    </>
  );
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
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role, isLoaded } = useRole();
  return (
    <>
      <Show when="signed-in">
        {!isLoaded ? <PageLoader /> : role === "platform_admin" ? (
          <AdminLayout>
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </AdminLayout>
        ) : (
          <Redirect to="/dashboard" />
        )}
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

// ── Workspace route ─────────────────────────────────────────────────────────────
// Law firm users only — platform_admin is redirected to their own world
function WorkspaceRoute({ children }: { children: React.ReactNode }) {
  const { role, isLoaded } = useRole();
  return (
    <>
      <Show when="signed-in">
        {!isLoaded ? <PageLoader /> : role === "platform_admin" ? (
          <Redirect to="/super-admin" />
        ) : (
          <OnboardingGate>
            <Layout>
              <Suspense fallback={<PageLoader />}>{children}</Suspense>
            </Layout>
          </OnboardingGate>
        )}
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

// ── Protected route wrapper ────────────────────────────────────────────────────
// Generic — any authenticated user (both roles can access)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <OnboardingGate>
          <Layout>
            <Suspense fallback={<PageLoader />}>
              {children}
            </Suspense>
          </Layout>
        </OnboardingGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

// ── Public route with Suspense ─────────────────────────────────────────────────
function PublicPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// ── All routes ─────────────────────────────────────────────────────────────────
function AppRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "مرحباً بعودتك", subtitle: "سجّل دخولك إلى منصة عدالة AI" } },
        signUp: { start: { title: "انضم إلى عدالة AI", subtitle: "أنشئ حسابك وابدأ الآن" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <OfficeThemeProvider />
        <TooltipProvider>
          <Switch>
            {/* ── Public ── */}
            <Route path="/" component={HomeRedirect} />
            <Route path="/pricing"><PublicPage><PricingPage /></PublicPage></Route>
            <Route path="/demo"><PublicPage><DemoPage /></PublicPage></Route>
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
            <Route path="/firms/:slug/store"><PublicPage><OfficeStore /></PublicPage></Route>
            <Route path="/firms/:slug/book"><PublicPage><OfficeBook /></PublicPage></Route>
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

            {/* Admin & Settings (law firm admins) */}
            <Route path="/users"><ProtectedRoute><Users /></ProtectedRoute></Route>
            <Route path="/office-settings"><ProtectedRoute><OfficeSettings /></ProtectedRoute></Route>
            <Route path="/office-management"><ProtectedRoute><OfficeManagement /></ProtectedRoute></Route>
            <Route path="/storage-settings"><ProtectedRoute><StorageSettings /></ProtectedRoute></Route>
            <Route path="/firm-admin"><ProtectedRoute><FirmAdmin /></ProtectedRoute></Route>
            <Route path="/backup"><ProtectedRoute><BackupCenter /></ProtectedRoute></Route>
            <Route path="/theme-builder"><ProtectedRoute><ThemeBuilderPage /></ProtectedRoute></Route>
            <Route path="/login-tracking"><ProtectedRoute><LoginTrackingPage /></ProtectedRoute></Route>
            <Route path="/my-sessions"><ProtectedRoute><MySessionsPage /></ProtectedRoute></Route>

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

            {/* 404 */}
            <Route><Layout><Suspense fallback={<PageLoader />}><NotFound /></Suspense></Layout></Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

// ── App root ───────────────────────────────────────────────────────────────────
function App() {
  return (
    <div dir="rtl" className="font-sans antialiased text-foreground bg-background min-h-screen">
      <WouterRouter base={basePath}>
        <AppRoutes />
      </WouterRouter>
    </div>
  );
}

export default App;
