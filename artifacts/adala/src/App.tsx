import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Cases from "@/pages/cases";
import CaseDetail from "@/pages/case-detail";
import Documents from "@/pages/documents";
import AiTasks from "@/pages/ai-tasks";
import Users from "@/pages/users";
import Messages from "@/pages/messages";
import Billing from "@/pages/billing";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/cases">
        <Layout><Cases /></Layout>
      </Route>
      <Route path="/cases/:id">
        {params => <Layout><CaseDetail id={params.id} /></Layout>}
      </Route>
      <Route path="/documents">
        <Layout><Documents /></Layout>
      </Route>
      <Route path="/ai-tasks">
        <Layout><AiTasks /></Layout>
      </Route>
      <Route path="/users">
        <Layout><Users /></Layout>
      </Route>
      <Route path="/messages">
        <Layout><Messages /></Layout>
      </Route>
      <Route path="/billing">
        <Layout><Billing /></Layout>
      </Route>
      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <div dir="rtl" className="font-sans antialiased text-foreground bg-background min-h-screen">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
