import { Router, type IRouter } from "express";
import twoFactorRouter from "../modules/auth/twoFactor";
import demoRouter      from "../modules/platform/demoMode";
import systemStatusRouter from "../modules/platform/systemStatus";

// ── Monitoring & Health ──────────────────────────────────────────────────────
import healthRouter            from "../modules/monitoring/health";
import monitoringRouter        from "../modules/monitoring/monitoring";
import preventionRouter        from "../modules/monitoring/prevention";
import smartAlertsRouter       from "../modules/monitoring/smart-alerts";
import isolationRouter         from "../modules/monitoring/isolation";
import zeroTrustRouter         from "../security/zero-trust-router";
import hardeningRouter         from "../modules/monitoring/hardening";
import selfHealingRouter       from "../modules/monitoring/self-healing";

// ── Legal Core ───────────────────────────────────────────────────────────────
import casesRouter             from "../modules/legal-core/cases";
import clientsRouter           from "../modules/legal-core/clients";
import documentsRouter         from "../modules/legal-core/documents";
import contractsRouter         from "../modules/legal-core/contracts";
import arbitrationRouter       from "../modules/legal-core/arbitration";
import judgePrepRouter         from "../modules/legal-core/judgePrep";
import legalResearchRouter     from "../modules/legal-core/legalResearch";
import legalAIRouter           from "../modules/legal-core/legalAI";
import mediatorsRouter         from "../modules/legal-core/mediators";
import complianceRouter        from "../modules/legal-core/compliance";
import signaturesRouter        from "../modules/legal-core/signatures";
import documentTemplatesRouter from "../modules/legal-core/document-templates";
import legalOsRouter           from "../modules/legal-core/legal-os";
import adoulRouter             from "../modules/legal-core/adoul";
import opponentSimulatorRouter from "../modules/legal-core/opponentSimulator";
import remindersRouter         from "../modules/legal-core/reminders";

// ── Financial ────────────────────────────────────────────────────────────────
import billingRouter               from "../modules/financial/billing";
import invoicesRouter              from "../modules/financial/invoices";
import paymentsRouter              from "../modules/financial/payments";
import accountingRouter            from "../modules/financial/accounting";
import journalAccountingRouter     from "../modules/financial/journalAccounting";
import financeCenterRouter         from "../modules/financial/finance-center";
import financeDashboardRouter      from "../modules/financial/finance-dashboard";
import financialCoreRouter         from "../modules/financial/financialCore";
import financialIntelligenceRouter from "../modules/financial/financialIntelligence";
import financialEngineRouter       from "../modules/financial/financial-engine";
import subscriptionRouter          from "../modules/financial/subscription";
import promoRouter                 from "../modules/financial/promo";
import stripeAdminRouter           from "../modules/financial/stripeAdmin";
import erpLedgerRouter             from "../modules/financial/erp-ledger";
import reconciliationRouter        from "../modules/financial/reconciliation";
import financialGuardRouter        from "../modules/financial/financial-guard";

// ── AI ───────────────────────────────────────────────────────────────────────
import aiGatewayRouter        from "../modules/ai/aiGateway";
import aiProviderEngineRouter from "../modules/ai/aiProviderEngine";
import aiChatRouter, { aiCostRouter } from "../modules/ai/aiChat";
import aiTasksRouter       from "../modules/ai/aiTasks";
import aiAgentsRouter      from "../modules/ai/aiAgents";
import aiAgentRouter       from "../modules/ai/ai-agent";
import aiEngineRouter      from "../modules/ai/ai-engine";
import aiWorkflowRouter    from "../modules/ai/ai-workflow";
import aiAssistantRouter   from "../modules/ai/ai-assistant";
import copilotRouter       from "../modules/ai/copilot";
import aiCommandCenterRouter from "../modules/ai/aiCommandCenter";
import devCommanderRouter    from "../modules/ai/devCommander";
import commandCenterV2Router from "../modules/ai/command-center/index";
import aiCreditsRouter     from "../modules/ai/aiCredits";
import aiEventsRouter      from "../modules/ai/aiEvents";
import uiBuilderRouter     from "../modules/ai/uiBuilder";
import commandCenterRouter from "../modules/ai/commandCenter";

// ── Platform ─────────────────────────────────────────────────────────────────
import adminRouter               from "../modules/platform/admin";
import managedIntegrationsRouter from "../modules/platform/managedIntegrations";
import usersRouter           from "../modules/platform/users";
import rbacRouter            from "../modules/platform/rbac";
import onboardingRouter      from "../modules/platform/onboarding";
import trialOnboardingRouter from "../modules/platform/trialOnboarding";
import developerRouter       from "../modules/platform/developer";
import engineeringRouter     from "../modules/platform/engineering";
import hostingRouter         from "../modules/platform/hosting";
import backupRouter          from "../modules/platform/backup";
import studioRouter          from "../modules/platform/studio";
import entitlementsRouter    from "../modules/platform/entitlements";
import planCmsRouter         from "../modules/platform/planCms";
import platformModulesRouter from "../modules/platform/platformModules";
import themeBuilderRouter    from "../modules/platform/themeBuilder";
import brandingRouter        from "../modules/platform/branding";
import loginTrackingRouter   from "../modules/platform/loginTracking";
import auditLogsRouter       from "../modules/platform/auditLogs";
import orgStructureRouter    from "../modules/platform/orgStructure";
import branchesRouter        from "../modules/platform/branches";
import supportAIRouter       from "../modules/platform/support-ai";
import infrastructureRouter  from "../modules/platform/infrastructure";
import dataVaultRouter       from "../modules/platform/dataVault";
import platformCommandRouter from "../modules/platform/platformCommand";
import agentRuntimeRouter    from "../modules/platform/agentRuntime";
import importDataRouter      from "../modules/platform/importData";
import investorMetricsRouter  from "../modules/platform/investorMetrics";
import deploymentCenterRouter from "../modules/platform/deploymentCenter";
import officeApiKeysRouter   from "../modules/platform/officeApiKeys";
import controlTowerRouter    from "../modules/platform/control-tower";
import saasOsRouter          from "../modules/platform/saas-os";
import productionOsRouter    from "../modules/platform/production-os";

// ── Integrations ─────────────────────────────────────────────────────────────
import emailRouter              from "../modules/integrations/email";
import emailNotificationsRouter from "../modules/integrations/emailNotifications";
import whatsappRouter           from "../modules/integrations/whatsapp";
import telegramRouter           from "../modules/integrations/telegram";
import pushRouter               from "../modules/integrations/push";
import webhookRouter            from "../modules/integrations/webhook";

// ── Marketplace ──────────────────────────────────────────────────────────────
import marketplaceRouter  from "../modules/marketplace/marketplace";
import officeRouter       from "../modules/marketplace/office";
import clientPortalRouter from "../modules/marketplace/client-portal";
import clientAuthRouter   from "../modules/marketplace/client-auth";
import firmAdminRouter    from "../modules/marketplace/firm-admin";
import homeCmsRouter      from "../modules/marketplace/homeCms";

// ── Operations ───────────────────────────────────────────────────────────────
import dashboardRouter        from "../modules/operations/dashboard";
import analyticsRouter        from "../modules/operations/analytics";
import searchRouter           from "../modules/operations/search";
import calendarRouter         from "../modules/operations/calendar";
import tasksRouter            from "../modules/operations/tasks";
import messagesRouter         from "../modules/operations/messages";
import internalMessagesRouter from "../modules/operations/internal-messages";
import notificationsRouter    from "../modules/operations/notifications";
import eventsRouter           from "../modules/operations/events";
import storageRouter          from "../modules/operations/storage";
import hrRouter               from "../modules/operations/hr";
import hrPerformanceRouter    from "../modules/operations/hrPerformance";
import hrInternalRouter       from "../modules/operations/hrInternal";
import hrEnterpriseRouter     from "../modules/operations/hr-enterprise";
import launchGateRouter       from "../modules/platform/launchGate";

// ─────────────────────────────────────────────────────────────────────────────
const router: IRouter = Router();

// Monitoring
router.use(launchGateRouter);
router.use(healthRouter);
router.use(monitoringRouter);
router.use(preventionRouter);
router.use(smartAlertsRouter);
router.use(isolationRouter);
router.use(zeroTrustRouter);
router.use(hardeningRouter);
router.use(selfHealingRouter);

// Legal Core
router.use(casesRouter);
router.use(clientsRouter);
router.use(documentsRouter);
router.use(contractsRouter);
router.use(arbitrationRouter);
router.use(judgePrepRouter);
router.use(legalResearchRouter);
router.use(legalAIRouter);
router.use(mediatorsRouter);
router.use(complianceRouter);
router.use(signaturesRouter);
router.use(remindersRouter);
router.use(opponentSimulatorRouter);
router.use("/adoul", adoulRouter);
router.use((req, _res, next) => {
  if (req.url === "/templates" || req.url.startsWith("/templates/") || req.url.startsWith("/templates?")) {
    req.url = "/document-templates" + req.url.slice("/templates".length);
  }
  next();
});
router.use(documentTemplatesRouter);
router.use(legalOsRouter);

// Financial
router.use(billingRouter);
router.use(invoicesRouter);
router.use(paymentsRouter);
router.use(accountingRouter);
router.use(journalAccountingRouter);
router.use(financeCenterRouter);
router.use(financeDashboardRouter);
router.use(financialCoreRouter);
router.use(financialIntelligenceRouter);
router.use(financialEngineRouter);
router.use(subscriptionRouter);
router.use(promoRouter);
router.use(stripeAdminRouter);
router.use(erpLedgerRouter);
router.use(reconciliationRouter);
router.use(financialGuardRouter);

// AI — Gateway first (unified entry point)
router.use(aiGatewayRouter);
router.use(aiProviderEngineRouter);
router.use(aiChatRouter);
router.use(aiCostRouter);
router.use(aiTasksRouter);
router.use(aiAgentsRouter);
router.use(aiAgentRouter);
router.use(aiEngineRouter);
router.use(aiWorkflowRouter);
router.use("/ai-assistant", aiAssistantRouter);
router.use("/copilot", copilotRouter);
router.use(aiCommandCenterRouter);
router.use(devCommanderRouter);
router.use(commandCenterV2Router);
router.use(aiCreditsRouter);
router.use(aiEventsRouter);
router.use(uiBuilderRouter);
router.use(commandCenterRouter);

// Platform
router.use(adminRouter);
router.use(managedIntegrationsRouter);
router.use(usersRouter);
router.use(rbacRouter);
router.use(onboardingRouter);
router.use(trialOnboardingRouter);
router.use(developerRouter);
router.use(engineeringRouter);
router.use(hostingRouter);
router.use(backupRouter);
router.use(studioRouter);
router.use(entitlementsRouter);
router.use(planCmsRouter);
router.use(platformModulesRouter);
router.use(themeBuilderRouter);
router.use(brandingRouter);
router.use(loginTrackingRouter);
router.use(auditLogsRouter);
router.use(orgStructureRouter);
router.use(branchesRouter);
router.use(supportAIRouter);
router.use(infrastructureRouter);
router.use(dataVaultRouter);
router.use(platformCommandRouter);
router.use(agentRuntimeRouter);
router.use(importDataRouter);
router.use(officeApiKeysRouter);
router.use(controlTowerRouter);
router.use(saasOsRouter);
router.use(productionOsRouter);
router.use(investorMetricsRouter);
router.use(deploymentCenterRouter);

// Integrations
router.use(emailRouter);
router.use(emailNotificationsRouter);
router.use(whatsappRouter);
router.use(telegramRouter);
router.use(pushRouter);
router.use(webhookRouter);

// Auth extensions (2FA + Demo)
router.use("/2fa",  twoFactorRouter);
router.use("/demo", demoRouter);

// Marketplace
router.use(marketplaceRouter);
router.use(officeRouter);
router.use(clientPortalRouter);
router.use(clientAuthRouter);
router.use(firmAdminRouter);
router.use(homeCmsRouter);

// Operations
router.use(dashboardRouter);
router.use(analyticsRouter);
router.use(searchRouter);
router.use(calendarRouter);
router.use(tasksRouter);
router.use(messagesRouter);
router.use("/internal-messages", internalMessagesRouter);
router.use(notificationsRouter);
router.use((req, _res, next) => {
  if (req.url === "/appointments" || req.url.startsWith("/appointments/") || req.url.startsWith("/appointments?")) {
    req.url = "/calendar/events" + req.url.slice("/appointments".length);
  }
  next();
});
router.use(eventsRouter);
router.use(storageRouter);
router.use(hrRouter);
router.use(hrPerformanceRouter);
router.use(hrInternalRouter);
router.use(hrEnterpriseRouter);
router.use(systemStatusRouter);

export default router;
