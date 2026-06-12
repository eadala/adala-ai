import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import BottomNav from "@/components/bottom-nav";
import AppHeader from "@/components/app-header";
import HomePage from "@/pages/home";
import CasesPage from "@/pages/cases";
import ClientsPage from "@/pages/clients";
import ContractsPage from "@/pages/contracts";
import RemindersPage from "@/pages/reminders";
import NotFoundPage from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function checkMobileEnabled(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/mobile-status`, { credentials: "include" });
    if (!r.ok) return true;
    const d = await r.json();
    return d.enabled !== false;
  } catch {
    return true;
  }
}

function MaintenanceScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#0D1B33] text-white p-8" dir="rtl">
      <div className="text-6xl mb-6">🛠️</div>
      <h1 className="text-2xl font-black text-[#C9A84C] mb-3">التطبيق تحت الصيانة</h1>
      <p className="text-center text-gray-400 text-sm leading-relaxed max-w-xs">
        نحن نعمل على تحسين تجربتك. سيعود التطبيق للعمل قريباً.
        <br /><br />
        للاستفسار تواصل مع فريق الدعم الفني.
      </p>
      <div className="mt-8 px-6 py-3 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-sm font-semibold">
        عدالة AI
      </div>
    </div>
  );
}

function AppShell() {
  const { data: enabled, isLoading } = useQuery({
    queryKey: ["mobile-status"],
    queryFn: checkMobileEnabled,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[#0D1B33]" dir="rtl">
        <div className="text-center">
          <div className="text-4xl mb-4">⚖️</div>
          <p className="text-[#C9A84C] font-semibold">عدالة AI</p>
        </div>
      </div>
    );
  }

  if (enabled === false) {
    return <MaintenanceScreen />;
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background" dir="rtl">
      <AppHeader />
      <main className="flex-1 overflow-y-auto pb-20">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/cases" component={CasesPage} />
          <Route path="/clients" component={ClientsPage} />
          <Route path="/contracts" component={ContractsPage} />
          <Route path="/reminders" component={RemindersPage} />
          <Route component={NotFoundPage} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={BASE}>
        <AppShell />
      </WouterRouter>
    </QueryClientProvider>
  );
}
