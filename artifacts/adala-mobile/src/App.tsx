import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function AppShell() {
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
