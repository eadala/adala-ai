import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { OfficeThemeProvider } from "@/components/office-theme-provider";
import Dashboard from "@/pages/dashboard";
import Cases from "@/pages/cases";
import CaseDetail from "@/pages/case-detail";
import Documents from "@/pages/documents";
import AiTasks from "@/pages/ai-tasks";
import Users from "@/pages/users";
import Messages from "@/pages/messages";
import Billing from "@/pages/billing";
import AiChat from "@/pages/ai-chat";
import OpponentSimulator from "@/pages/opponent-simulator";
import AiAgents from "@/pages/ai-agents";
import CommandCenter from "@/pages/command-center";
import Contracts from "@/pages/contracts";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import LegalResearch from "@/pages/legal-research";
import Arbitration from "@/pages/arbitration";
import RiskManagement from "@/pages/risk-management";
import Analytics from "@/pages/analytics";
import Compliance from "@/pages/compliance";
import Employees from "@/pages/employees";
import Attendance from "@/pages/attendance";
import Leaves from "@/pages/leaves";
import Payroll from "@/pages/payroll";
import OfficeSettings from "@/pages/office-settings";
import JudgePrep from "@/pages/judge-prep";
import SaudiSystems from "@/pages/saudi-systems";
import Invoices from "@/pages/invoices";
import Letters from "@/pages/letters";
import Warnings from "@/pages/warnings";
import PricingPage from "@/pages/pricing";
import OfficePage from "@/pages/office-public";
import OfficeStore from "@/pages/office-store";
import OfficeBook from "@/pages/office-book";
import OfficeManagement from "@/pages/office-management";
import SuperAdmin from "@/pages/super-admin";
import BackupCenter from "@/pages/backup";
import Revenues from "@/pages/revenues";
import Expenses from "@/pages/expenses";
import FinancialReports from "@/pages/financial-reports";
import Cashflow from "@/pages/cashflow";
import BankAccounts from "@/pages/bank-accounts";
import Advances from "@/pages/advances";
import PaymentCenter from "@/pages/payment-center";
import FirmAdmin from "@/pages/firm-admin";
import CalendarPage from "@/pages/calendar";
import ClientPortal from "@/pages/client-portal";
import PortalView from "@/pages/portal-view";
import Marketplace from "@/pages/marketplace";
import AIAssistant from "@/pages/ai-assistant";
import Landing from "@/pages/landing";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import SecurityPage from "@/pages/security";
import NotFound from "@/pages/not-found";
import AdalaBuildStudio from "@/pages/studio";
import StorageSettings from "@/pages/storage-settings";
import DemoPage from "@/pages/demo";
import LoginTrackingPage from "@/pages/login-tracking";
import FinancialIntelligence from "@/pages/financial-intelligence";
import RemindersPage from "@/pages/reminders";
import OnboardingPage from "@/pages/onboarding";
import EmailNotificationsPage from "@/pages/email-notifications";

const queryClient = new QueryClient();

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

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>{children}</Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

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
        signIn: {
          start: {
            title: "مرحباً بعودتك",
            subtitle: "سجّل دخولك إلى منصة عدالة AI",
          },
        },
        signUp: {
          start: {
            title: "انضم إلى عدالة AI",
            subtitle: "أنشئ حسابك وابدأ الآن",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <OfficeThemeProvider />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/demo" component={DemoPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/security" component={SecurityPage} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard">
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            </Route>
            <Route path="/cases">
              <ProtectedRoute><Cases /></ProtectedRoute>
            </Route>
            <Route path="/cases/:id">
              {params => <ProtectedRoute><CaseDetail id={params.id} /></ProtectedRoute>}
            </Route>
            <Route path="/documents">
              <ProtectedRoute><Documents /></ProtectedRoute>
            </Route>
            <Route path="/ai-tasks">
              <ProtectedRoute><AiTasks /></ProtectedRoute>
            </Route>
            <Route path="/ai-chat">
              <ProtectedRoute><AiChat /></ProtectedRoute>
            </Route>
            <Route path="/opponent-simulator">
              <ProtectedRoute><OpponentSimulator /></ProtectedRoute>
            </Route>
            <Route path="/ai-agents">
              <ProtectedRoute><AiAgents /></ProtectedRoute>
            </Route>
            <Route path="/command-center">
              <ProtectedRoute><CommandCenter /></ProtectedRoute>
            </Route>
            <Route path="/contracts">
              <ProtectedRoute><Contracts /></ProtectedRoute>
            </Route>
            <Route path="/clients">
              <ProtectedRoute><Clients /></ProtectedRoute>
            </Route>
            <Route path="/clients/:id">
              {params => <ProtectedRoute><ClientDetail /></ProtectedRoute>}
            </Route>
            <Route path="/legal-research">
              <ProtectedRoute><LegalResearch /></ProtectedRoute>
            </Route>
            <Route path="/arbitration">
              <ProtectedRoute><Arbitration /></ProtectedRoute>
            </Route>
            <Route path="/risk-management">
              <ProtectedRoute><RiskManagement /></ProtectedRoute>
            </Route>
            <Route path="/analytics">
              <ProtectedRoute><Analytics /></ProtectedRoute>
            </Route>
            <Route path="/compliance">
              <ProtectedRoute><Compliance /></ProtectedRoute>
            </Route>
            <Route path="/login-tracking">
              <ProtectedRoute><LoginTrackingPage /></ProtectedRoute>
            </Route>
            <Route path="/financial-intelligence">
              <ProtectedRoute><FinancialIntelligence /></ProtectedRoute>
            </Route>
            <Route path="/employees">
              <ProtectedRoute><Employees /></ProtectedRoute>
            </Route>
            <Route path="/attendance">
              <ProtectedRoute><Attendance /></ProtectedRoute>
            </Route>
            <Route path="/leaves">
              <ProtectedRoute><Leaves /></ProtectedRoute>
            </Route>
            <Route path="/payroll">
              <ProtectedRoute><Payroll /></ProtectedRoute>
            </Route>
            <Route path="/office-settings">
              <ProtectedRoute><OfficeSettings /></ProtectedRoute>
            </Route>
            <Route path="/backup">
              <ProtectedRoute><BackupCenter /></ProtectedRoute>
            </Route>
            <Route path="/revenues">
              <ProtectedRoute><Revenues /></ProtectedRoute>
            </Route>
            <Route path="/expenses">
              <ProtectedRoute><Expenses /></ProtectedRoute>
            </Route>
            <Route path="/financial-reports">
              <ProtectedRoute><FinancialReports /></ProtectedRoute>
            </Route>
            <Route path="/cashflow">
              <ProtectedRoute><Cashflow /></ProtectedRoute>
            </Route>
            <Route path="/bank-accounts">
              <ProtectedRoute><BankAccounts /></ProtectedRoute>
            </Route>
            <Route path="/advances">
              <ProtectedRoute><Advances /></ProtectedRoute>
            </Route>
            <Route path="/payment-center">
              <ProtectedRoute><PaymentCenter /></ProtectedRoute>
            </Route>
            <Route path="/judge-prep">
              <ProtectedRoute><JudgePrep /></ProtectedRoute>
            </Route>
            <Route path="/saudi-systems">
              <ProtectedRoute><SaudiSystems /></ProtectedRoute>
            </Route>
            <Route path="/invoices">
              <ProtectedRoute><Invoices /></ProtectedRoute>
            </Route>
            <Route path="/letters">
              <ProtectedRoute><Letters /></ProtectedRoute>
            </Route>
            <Route path="/warnings">
              <ProtectedRoute><Warnings /></ProtectedRoute>
            </Route>
            <Route path="/office-management">
              <ProtectedRoute><OfficeManagement /></ProtectedRoute>
            </Route>
            <Route path="/super-admin">
              <ProtectedRoute><SuperAdmin /></ProtectedRoute>
            </Route>
            <Route path="/studio">
              <ProtectedRoute><AdalaBuildStudio /></ProtectedRoute>
            </Route>
            <Route path="/storage-settings">
              <ProtectedRoute><StorageSettings /></ProtectedRoute>
            </Route>
            <Route path="/firm-admin">
              <ProtectedRoute><FirmAdmin /></ProtectedRoute>
            </Route>
            <Route path="/firms/:slug/store">
              <OfficeStore />
            </Route>
            <Route path="/firms/:slug/book">
              <OfficeBook />
            </Route>
            <Route path="/firms/:slug">
              <OfficePage />
            </Route>
            <Route path="/users">
              <ProtectedRoute><Users /></ProtectedRoute>
            </Route>
            <Route path="/messages">
              <ProtectedRoute><Messages /></ProtectedRoute>
            </Route>
            <Route path="/ai-assistant">
              <ProtectedRoute><AIAssistant /></ProtectedRoute>
            </Route>
            <Route path="/billing">
              <ProtectedRoute><Billing /></ProtectedRoute>
            </Route>
            <Route path="/reminders">
              <ProtectedRoute><RemindersPage /></ProtectedRoute>
            </Route>
            <Route path="/email-notifications">
              <ProtectedRoute><EmailNotificationsPage /></ProtectedRoute>
            </Route>
            <Route path="/onboarding">
              <OnboardingPage />
            </Route>
            <Route path="/calendar">
              <ProtectedRoute><CalendarPage /></ProtectedRoute>
            </Route>
            <Route path="/client-portal">
              <ProtectedRoute><ClientPortal /></ProtectedRoute>
            </Route>
            <Route path="/marketplace">
              <ProtectedRoute><Marketplace /></ProtectedRoute>
            </Route>
            <Route path="/portal/:token">
              <PortalView />
            </Route>
            <Route>
              <Layout><NotFound /></Layout>
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

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
