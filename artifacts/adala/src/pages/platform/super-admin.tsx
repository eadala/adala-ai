import { lazy, Suspense, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Lock, Fingerprint, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { setTokenGetter, API } from "@/features/super-admin/shared/api";
import { TABS } from "@/features/super-admin/shared/constants";
import { DEV_API } from "@/features/super-admin/shared/api";

/* ── Eager (small/critical tabs) ─────────────────── */
import { OverviewTab }           from "@/features/super-admin/tabs/OverviewTab";
import { OfficesTab }            from "@/features/super-admin/tabs/OfficesTab";
import { UsersTab }              from "@/features/super-admin/tabs/UsersTab";
import { PlansTab }              from "@/features/super-admin/tabs/PlansTab";
import { DiscountsTab }          from "@/features/super-admin/tabs/DiscountsTab";
import { AiKeysTab }             from "@/features/super-admin/tabs/AiKeysTab";
import { UsageTab }              from "@/features/super-admin/tabs/UsageTab";
import { DepartmentsTab }        from "@/features/super-admin/tabs/DepartmentsTab";
import { LegalSystemsTab }       from "@/features/super-admin/tabs/LegalSystemsTab";
import { SupportTab }            from "@/features/super-admin/tabs/SupportTab";
import { SettingsTab }           from "@/features/super-admin/tabs/SettingsTab";
import { PlatformCasesTab }      from "@/features/super-admin/tabs/PlatformCasesTab";
import { PlatformContractsTab }  from "@/features/super-admin/tabs/PlatformContractsTab";
import { PlatformFinanceTab }    from "@/features/super-admin/tabs/PlatformFinanceTab";
import { PlatformReportsTab }    from "@/features/super-admin/tabs/PlatformReportsTab";
import { PlatformSecurityTab }   from "@/features/super-admin/tabs/PlatformSecurityTab";
import { PlatformWebsiteTab }    from "@/features/super-admin/tabs/PlatformWebsiteTab";
import { EngineeringHeroTab }    from "@/features/super-admin/tabs/EngineeringHeroTab";
import { AgentRuntimeTab }       from "@/features/super-admin/tabs/AgentRuntimeTab";

/* ── Lazy (heavy tabs — loaded on demand) ─────────── */
const DevCenterTab              = lazy(() => import("@/features/super-admin/tabs/DevCenterTab").then(m => ({ default: m.DevCenterTab })));
const HostingCenterTab          = lazy(() => import("@/features/super-admin/tabs/HostingCenterTab").then(m => ({ default: m.HostingCenterTab })));
const PlatformBillingTab        = lazy(() => import("@/features/super-admin/tabs/PlatformBillingTab").then(m => ({ default: m.PlatformBillingTab })));
const AiCreditsTab              = lazy(() => import("@/features/super-admin/tabs/AiCreditsTab").then(m => ({ default: m.AiCreditsTab })));
const GlobalControlTab          = lazy(() => import("@/features/super-admin/tabs/GlobalControlTab").then(m => ({ default: m.GlobalControlTab })));
const TrialsDashTab             = lazy(() => import("@/features/super-admin/tabs/TrialsDashTab").then(m => ({ default: m.TrialsDashTab })));
const HomeCmsTab                = lazy(() => import("@/features/super-admin/tabs/HomeCmsTab").then(m => ({ default: m.HomeCmsTab })));
const PlansCmsTab               = lazy(() => import("@/features/super-admin/tabs/PlansCmsTab").then(m => ({ default: m.PlansCmsTab })));
const PromoCodesTab             = lazy(() => import("@/features/super-admin/tabs/PromoCodesTab").then(m => ({ default: m.PromoCodesTab })));
const GhostCenterTab            = lazy(() => import("@/features/super-admin/tabs/GhostCenterTab").then(m => ({ default: m.GhostCenterTab })));
const PlatformCommandCenterTab  = lazy(() => import("@/features/super-admin/tabs/PlatformCommandCenterTab").then(m => ({ default: m.PlatformCommandCenterTab })));
const DesignCenterTab           = lazy(() => import("@/features/super-admin/tabs/DesignCenterTab").then(m => ({ default: m.DesignCenterTab })));

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function SuperAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const { getToken } = useAuth();

  /* Inject token getter so shared API() can use it */
  setTokenGetter(getToken);

  const { data: stats, error: statsError } = useQuery<any>({
    queryKey: ["admin", "/stats"],
    queryFn: () => API("/stats"),
    retry: false,
  });

  const { data: ghostStatus, refetch: refetchGhost } = useQuery<any>({
    queryKey: ["ghost", "status"],
    queryFn: () => DEV_API("/impersonate/status"),
    retry: false,
    refetchInterval: 60_000,
  });

  if (statsError?.message?.includes("403") || statsError?.message?.includes("غير مصرح")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-lg font-black text-red-400">غير مصرح بالدخول</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          هذه اللوحة مخصصة لمالك المنصة فقط. تحقق من إعداد{" "}
          <code className="bg-muted px-1 rounded text-xs">PLATFORM_OWNER_EMAIL</code>{" "}
          في متغيرات البيئة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
          <Crown className="h-5 w-5 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-xl font-black">لوحة التحكم العليا</h1>
          <p className="text-xs text-muted-foreground">Super Admin — أعلى صلاحية في النظام</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-bold px-2 py-1 rounded-lg">
            <Crown className="h-3 w-3" /> Super Admin
          </span>
          {ghostStatus?.active && (
            <button
              onClick={() => setTab("ghost-access")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs cursor-pointer hover:bg-violet-500/15 transition-colors animate-pulse"
            >
              <Fingerprint className="h-3.5 w-3.5" />
              <span className="font-bold">{ghostStatus.officeName}</span>
              <span className="text-violet-400/60">• جلسة خفية</span>
            </button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/50 p-1 rounded-xl">
          {TABS.map(t => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 py-1.5"
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Eager tabs ── */}
        <TabsContent value="overview"    className="mt-4"><OverviewTab stats={stats} /></TabsContent>
        <TabsContent value="offices"     className="mt-4"><OfficesTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="users"       className="mt-4"><UsersTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="cases"       className="mt-4"><PlatformCasesTab /></TabsContent>
        <TabsContent value="contracts"   className="mt-4"><PlatformContractsTab /></TabsContent>
        <TabsContent value="finance"     className="mt-4"><PlatformFinanceTab /></TabsContent>
        <TabsContent value="reports"     className="mt-4"><PlatformReportsTab /></TabsContent>
        <TabsContent value="plans"       className="mt-4"><PlansTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="discounts"   className="mt-4"><DiscountsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="ai-keys"     className="mt-4"><AiKeysTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="usage"       className="mt-4"><UsageTab /></TabsContent>
        <TabsContent value="departments" className="mt-4"><DepartmentsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="legal"       className="mt-4"><LegalSystemsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="support"     className="mt-4"><SupportTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="security"    className="mt-4"><PlatformSecurityTab /></TabsContent>
        <TabsContent value="website"     className="mt-4"><PlatformWebsiteTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="settings"    className="mt-4"><SettingsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="engineering" className="mt-4"><EngineeringHeroTab /></TabsContent>
        <TabsContent value="agents"      className="mt-4"><AgentRuntimeTab toast={toast} /></TabsContent>

        {/* ── Lazy tabs (Suspense boundary per tab) ── */}
        <TabsContent value="developer"      className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <DevCenterTab toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="hosting"        className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <HostingCenterTab toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="saas-billing"   className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <PlatformBillingTab toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="ai-credits"     className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <AiCreditsTab qc={qc} toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="global-control" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <GlobalControlTab toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="trials"         className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <TrialsDashTab toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="home-cms"       className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <HomeCmsTab toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="plans-cms"      className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <PlansCmsTab toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="promo-codes"    className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <PromoCodesTab qc={qc} toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="ghost-access"   className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <GhostCenterTab toast={toast} onRefreshHeader={refetchGhost} />
          </Suspense>
        </TabsContent>
        <TabsContent value="pcc"            className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <PlatformCommandCenterTab toast={toast} />
          </Suspense>
        </TabsContent>
        <TabsContent value="design"         className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <DesignCenterTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
