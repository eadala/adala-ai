import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import Home from "@/pages/home";
import Cases from "@/pages/cases";
import Clients from "@/pages/clients";
import Invoices from "@/pages/invoices";
import Reminders from "@/pages/reminders";
import Contracts from "@/pages/contracts";
import BottomNav from "@/components/bottom-nav";
import AppHeader from "@/components/app-header";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function PageTitle() {
  const [location] = useLocation();
  const titles: Record<string, string> = {
    "/":           "لوحة التحكم",
    "/cases":      "القضايا",
    "/clients":    "العملاء",
    "/invoices":   "الفواتير",
    "/reminders":  "التذكيرات",
    "/contracts":  "العقود",
  };
  return <AppHeader title={titles[location] ?? "عدالة AI"} />;
}

function AppLayout() {
  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageTitle />
      <main className="flex-1 overflow-y-auto pb-20">
        <Switch>
          <Route path="/"          component={Home} />
          <Route path="/cases"     component={Cases} />
          <Route path="/clients"   component={Clients} />
          <Route path="/invoices"  component={Invoices} />
          <Route path="/reminders" component={Reminders} />
          <Route path="/contracts" component={Contracts} />
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
        <AppLayout />
      </WouterRouter>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
