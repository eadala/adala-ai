#!/usr/bin/env node
/**
 * Platform Governance Check — عدالة AI Platform
 * فاحص حوكمة المنصة الشامل — يفحص جميع الطبقات
 *
 * يُشغَّل ضمن CI/CD: node scripts/governance/platform-check.mjs
 * يخرج بكود 0 عند النجاح الكامل، 1 عند وجود مشاكل حرجة
 *
 * الطبقات التي يفحصها:
 *  1. Permissions Registry
 *  2. Feature Flags Registry
 *  3. Events Registry
 *  4. AI Registry
 *  5. Integrations Registry
 *  6. Background Jobs Registry
 *  7. DB Registry
 *  8. API Layer (env vars, critical routes)
 *  9. Tenant Security Foundation (Phase 1)
 * 10. Authorization Foundation (Phase 2 — PR-AUTH-001, warn mode)
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const FRONTEND = resolve(ROOT, "artifacts/adala");
const BACKEND = resolve(ROOT, "artifacts/api-server");

/* ── output helpers ──────────────────────────────────────── */
const C = { RED: "\x1b[31m", GREEN: "\x1b[32m", YELLOW: "\x1b[33m", CYAN: "\x1b[36m", BOLD: "\x1b[1m", DIM: "\x1b[2m", RESET: "\x1b[0m" };
const pass  = (m) => console.log(`${C.GREEN}  ✅ ${m}${C.RESET}`);
const fail  = (m) => console.log(`${C.RED}  ❌ ${m}${C.RESET}`);
const warn  = (m) => console.log(`${C.YELLOW}  ⚠️  ${m}${C.RESET}`);
const info  = (m) => console.log(`${C.DIM}     ${m}${C.RESET}`);
const head  = (m) => console.log(`\n${C.BOLD}${C.CYAN}▶ ${m}${C.RESET}`);

function readSrc(base, relPath) {
  const p = resolve(base, relPath);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

let totalIssues = 0;
let totalWarnings = 0;
const results = {};

function recordResult(layer, passed, issues = 0, warnings = 0) {
  results[layer] = { passed, issues, warnings };
  totalIssues += issues;
  totalWarnings += warnings;
}

/* ═════════════════════════════════════════════════════════
   1. Permissions Registry
═════════════════════════════════════════════════════════ */
head("1/10 Permissions Registry");
const permSrc = readSrc(FRONTEND, "src/lib/permissionsRegistry.ts");
const catalogSrc = readSrc(BACKEND, "src/core/authorization/permissionCatalog.ts") ?? "";
const catalogKeys = [...catalogSrc.matchAll(/"([a-z_]+:[a-z_]+)"/g)].map((m) => m[1]);
const catalogKeySet = new Set(catalogKeys);

if (!permSrc) {
  fail("permissionsRegistry.ts غير موجود");
  recordResult("permissions", false, 1);
} else if (!catalogSrc) {
  fail("permissionCatalog.ts غير موجود");
  recordResult("permissions", false, 1);
} else {
  const permKeys = [...permSrc.matchAll(/key:\s*"([^"]+)"/g)].map(m => m[1]);
  info(`${permKeys.length} صلاحية frontend | ${catalogKeys.length} backend catalog`);

  const backendModulesSrc = readSrc(BACKEND, "src/middlewares/requireAuth.ts") ?? "";
  const modulesGlob = ["src/modules/platform/rbac.ts", "src/modules/legal-core/cases.ts"];
  let backendPermSrc = backendModulesSrc;
  for (const rel of modulesGlob) {
    backendPermSrc += readSrc(BACKEND, rel) ?? "";
  }
  const backendPerms = [...backendPermSrc.matchAll(/requirePermission\(["']([^"']+)["']\)/g)].map(m => m[1]);
  const unknownBackendPerms = backendPerms.filter((p) => !catalogKeySet.has(p));
  if (unknownBackendPerms.length === 0) {
    pass(`requirePermission keys في catalog (${[...new Set(backendPerms)].length})`);
  } else {
    unknownBackendPerms.forEach((p) => warn(`صلاحية غير معتمدة في catalog: ${p}`));
  }

  const aliasMap = {
    "cases:manage": "cases:edit",
    "clients:manage": "clients:edit",
    "users:manage": "users:edit",
    "settings:manage": "settings:edit",
    "financial:manage": "financial:view",
    "reports:export": "reports:view",
  };
  const drift = permKeys.filter((k) => !catalogKeySet.has(k) && !aliasMap[k]);
  if (drift.length === 0) {
    pass("frontend registry متوافق مع backend catalog (مع aliases معروفة)");
    recordResult("permissions", true, 0, unknownBackendPerms.length > 0 ? 1 : 0);
  } else {
    drift.forEach((p) => warn(`frontend key غير موجود في catalog: ${p}`));
    recordResult("permissions", true, 0, drift.length);
  }
}

/* ═════════════════════════════════════════════════════════
   2. Feature Flags Registry
═════════════════════════════════════════════════════════ */
head("2/8 Feature Flags Registry");
const flagsSrc = readSrc(FRONTEND, "src/lib/featureFlagsRegistry.ts");
if (!flagsSrc) {
  fail("featureFlagsRegistry.ts غير موجود");
  recordResult("features", false, 1);
} else {
  const flagKeys = [...flagsSrc.matchAll(/key:\s*"([^"]+)"/g)].map(m => m[1]);
  info(`${flagKeys.length} Feature Flag مسجّل`);

  // Check TRIAL_FEATURE_FLAGS in backend matches flags
  // Only match keys inside TRIAL_FEATURE_FLAGS object (camelCase, length >3, no reserved words)
  const subscriptionSrc = readSrc(BACKEND, "src/modules/financial/subscription.ts") ?? "";
  const flagBlockMatch = subscriptionSrc.match(/TRIAL_FEATURE_FLAGS[^{]*\{([^}]+)\}/s);
  const flagBlockText = flagBlockMatch?.[1] ?? "";
  const trialFlags = [...flagBlockText.matchAll(/^\s*(\w+):\s*(true|false)/gm)].map(m => m[1]);
  const SKIP_FLAG_WORDS = new Set(["isActive", "isTrial", "isGift", "ok", "active", "enabled", "disabled"]);
  const unregisteredFlags = trialFlags.filter(f => !flagKeys.includes(f) && !SKIP_FLAG_WORDS.has(f));
  if (unregisteredFlags.length === 0) {
    pass(`Feature Flags في subscription.ts متوافقة مع Registry (${trialFlags.length})`);
  } else {
    unregisteredFlags.forEach(f => warn(`Flag في subscription.ts غير مسجّل: ${f}`));
  }

  // Check routeRegistry feature references
  const routeRegSrc = readSrc(FRONTEND, "src/lib/routeRegistry.ts") ?? "";
  const routeFeatures = [...routeRegSrc.matchAll(/feature:\s*"([^"]+)"/g)].map(m => m[1]);
  const invalidFeatures = routeFeatures.filter(f => !flagKeys.includes(f));
  if (invalidFeatures.length === 0) {
    pass(`Feature references في routeRegistry.ts صحيحة (${routeFeatures.length})`);
    recordResult("features", true, 0, unregisteredFlags.length);
  } else {
    invalidFeatures.forEach(f => fail(`Feature مجهول في routeRegistry: "${f}"`));
    recordResult("features", false, invalidFeatures.length, unregisteredFlags.length);
  }
}

/* ═════════════════════════════════════════════════════════
   3. Events Registry
═════════════════════════════════════════════════════════ */
head("3/8 Events Registry");
const eventRegSrc = readSrc(BACKEND, "src/lib/eventsRegistry.ts");
const eventBusSrc = readSrc(BACKEND, "src/core/eventBus.ts");
if (!eventRegSrc || !eventBusSrc) {
  fail("eventsRegistry.ts أو eventBus.ts غير موجود");
  recordResult("events", false, 1);
} else {
  const registeredTypes = [...eventRegSrc.matchAll(/type:\s*"([^"]+)"/g)].map(m => m[1]);
  const busTypes = [...eventBusSrc.matchAll(/"([A-Z_]+)"/g)].map(m => m[1]).filter(t => t.includes("_") && !t.includes("error"));
  const uniqueBusTypes = [...new Set(busTypes)];

  const unregistered = uniqueBusTypes.filter(t =>
    !registeredTypes.includes(t) &&
    t.length > 3 &&
    !["DB_ERROR", "SYSTEM_START"].includes(t)
  );

  info(`${registeredTypes.length} حدث في Registry | ${uniqueBusTypes.length} نوع في EventBus`);

  if (unregistered.length === 0) {
    pass("جميع Event Types في EventBus مسجّلة");
    recordResult("events", true, 0);
  } else {
    unregistered.slice(0, 5).forEach(t => warn(`Event Type غير مسجّل: ${t}`));
    recordResult("events", true, 0, unregistered.length);
  }
}

/* ═════════════════════════════════════════════════════════
   4. AI Registry
═════════════════════════════════════════════════════════ */
head("4/8 AI Registry");
const aiRegSrc = readSrc(BACKEND, "src/lib/aiRegistry.ts");
const aiChatSrc = readSrc(BACKEND, "src/lib/aiChat.ts") ?? "";
if (!aiRegSrc) {
  fail("aiRegistry.ts غير موجود");
  recordResult("ai", false, 1);
} else {
  const registeredModels = [...aiRegSrc.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
  const registeredAgents = [...aiRegSrc.matchAll(/id:\s*"([a-z-]+)"/g)].map(m => m[1]);

  // Check that at least one Gemini model is registered
  const hasGemini = registeredModels.some(m => m.includes("gemini"));
  const hasFallback = registeredModels.some(m => m.includes("template") || m.includes("fallback"));
  const agentCount = aiRegSrc.match(/AI_AGENTS\s*:/g)?.length ?? 0;

  info(`${registeredModels.length} نموذج | ${registeredAgents.length} وكيل ذكي`);

  if (!hasGemini) fail("لا يوجد نموذج Gemini مسجّل كـ default");
  else pass("Gemini مسجّل كنموذج أساسي");

  if (!hasFallback) warn("لا يوجد نموذج fallback مسجّل");
  else pass("نموذج fallback مسجّل");

  // Check env var requirements for active models
  const missingEnvWarnings = [];
  if (aiChatSrc.includes("GEMINI_API_KEY") && !aiRegSrc.includes("GEMINI_API_KEY")) {
    missingEnvWarnings.push("GEMINI_API_KEY مستخدم لكن غير موثّق في Registry");
  }
  missingEnvWarnings.forEach(w => warn(w));

  recordResult("ai", true, 0, missingEnvWarnings.length + (hasFallback ? 0 : 1));
}

/* ═════════════════════════════════════════════════════════
   5. Integrations Registry
═════════════════════════════════════════════════════════ */
head("5/8 Integrations Registry");
const intRegSrc = readSrc(BACKEND, "src/lib/integrationsRegistry.ts");
const appSrc = readSrc(BACKEND, "src/app.ts") ?? "";
if (!intRegSrc) {
  fail("integrationsRegistry.ts غير موجود");
  recordResult("integrations", false, 1);
} else {
  const registeredIds = [...intRegSrc.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
  const webhookPaths = [...intRegSrc.matchAll(/webhookPath:\s*"([^"]+)"/g)].map(m => m[1]);

  info(`${registeredIds.length} تكامل مسجّل | ${webhookPaths.length} webhook`);

  // Verify webhook paths exist in app.ts or routes
  const routesIndexSrc = readSrc(BACKEND, "src/routes/index.ts") ?? "";
  const missingWebhooks = webhookPaths.filter(p => {
    const cleanPath = p.replace("/api/", "").split("/")[0];
    return !routesIndexSrc.includes(cleanPath) && !appSrc.includes(cleanPath);
  });

  if (missingWebhooks.length === 0) {
    pass(`جميع webhook paths موجودة في routes (${webhookPaths.length})`);
  } else {
    missingWebhooks.forEach(p => warn(`Webhook path قد لا يكون مسجّلاً: ${p}`));
  }

  // Check active integrations have env var documented
  const activeIntegrations = [...intRegSrc.matchAll(/status:\s*"active"/g)].length;
  pass(`${activeIntegrations} تكامل نشط مسجّل`);

  recordResult("integrations", true, 0, missingWebhooks.length);
}

/* ═════════════════════════════════════════════════════════
   6. Background Jobs Registry
═════════════════════════════════════════════════════════ */
head("6/8 Background Jobs Registry");
const jobsRegSrc = readSrc(BACKEND, "src/lib/backgroundJobsRegistry.ts");
const cronFiles = ["src/cron/emailCron.ts", "src/cron/agentCron.ts", "src/cron/logRotationCron.ts", "src/cron/monitoringCron.ts"];
if (!jobsRegSrc) {
  fail("backgroundJobsRegistry.ts غير موجود");
  recordResult("jobs", false, 1);
} else {
  const registeredJobs = [...jobsRegSrc.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
  info(`${registeredJobs.length} مهمة مسجّلة`);

  let cronCount = 0;
  let missingFiles = 0;
  for (const cronFile of cronFiles) {
    const src = readSrc(BACKEND, cronFile);
    if (!src) { warn(`ملف cron غير موجود: ${cronFile}`); missingFiles++; continue; }
    const schedules = [...src.matchAll(/cron\.schedule\(/g)].length;
    cronCount += schedules;
  }

  info(`${cronCount} cron.schedule() في ${cronFiles.length - missingFiles} ملف`);

  if (registeredJobs.length > 0) {
    pass(`Registry يحتوي ${registeredJobs.length} مهمة موثّقة`);
  }

  // Check that critical jobs have alertOnFailure
  const alertJobs = [...jobsRegSrc.matchAll(/alertOnFailure:\s*true/g)].length;
  if (alertJobs >= 2) {
    pass(`${alertJobs} مهام حرجة لها alertOnFailure: true`);
  } else {
    warn("عدد قليل من المهام تحتوي alertOnFailure");
  }

  recordResult("jobs", true, missingFiles, 0);
}

/* ═════════════════════════════════════════════════════════
   7. DB Registry
═════════════════════════════════════════════════════════ */
head("7/8 DB Registry");
const dbRegSrc = readSrc(BACKEND, "src/lib/dbRegistry.ts");
if (!dbRegSrc) {
  fail("dbRegistry.ts غير موجود");
  recordResult("db", false, 1);
} else {
  const registeredTables = [...dbRegSrc.matchAll(/tableName:\s*"([^"]+)"/g)].map(m => m[1]);
  const officeIsolated = [...dbRegSrc.matchAll(/isolation:\s*"office_id"/g)].length;
  const withIndexes = [...dbRegSrc.matchAll(/requiredIndexes:\s*\[([^\]]+)\]/g)]
    .filter(m => m[1].trim().length > 0).length;

  info(`${registeredTables.length} جدول مسجّل | ${officeIsolated} بعزل office_id | ${withIndexes} بفهارس محددة`);

  // Check for tables without office_id in schema files
  const schemaSrc = readSrc(BACKEND, "src/db/schema.ts") ?? "";
  const schemaTablesCount = [...schemaSrc.matchAll(/pgTable\(/g)].length;
  info(`جداول في schema.ts: ${schemaTablesCount} | مسجّل في Registry: ${registeredTables.length}`);

  if (schemaTablesCount > registeredTables.length + 5) {
    warn(`يوجد ~${schemaTablesCount - registeredTables.length} جداول في schema.ts غير مسجّلة بعد في Registry`);
    recordResult("db", true, 0, 1);
  } else {
    pass("DB Registry يغطي الجداول الرئيسية");
    recordResult("db", true, 0, 0);
  }

  // Verify all office_id tables have an index for it
  // Split on each tableName: entry to get individual table definition blocks
  const tablesWithoutIndex = [];
  const tableEntryRegex = /tableName:\s*"([^"]+)"[\s\S]*?isolation:\s*"([^"]+)"[\s\S]*?requiredIndexes:\s*\[([\s\S]*?)\]/g;
  let tblMatch;
  while ((tblMatch = tableEntryRegex.exec(dbRegSrc)) !== null) {
    const [, tName, isolation, indexBlock] = tblMatch;
    if (isolation === "office_id" && !indexBlock.includes("office_id")) {
      tablesWithoutIndex.push(tName);
    }
  }
  if (tablesWithoutIndex.length === 0) {
    pass("جميع جداول office_id لها فهرس idx_*_office_id");
  } else {
    tablesWithoutIndex.forEach(t => warn(`جدول بدون فهرس office_id: ${t}`));
  }
}

/* ═════════════════════════════════════════════════════════
   8. API Layer
═════════════════════════════════════════════════════════ */
head("8/8 API Layer — Rate Limiting & Security");
const rateLimitPaths = [...appSrc.matchAll(/app\.use\("([^"]+)",\s*(?:strict|auth|register|upload|info)Limiter\)/g)]
  .map(m => m[1]);
const criticalPaths = ["/api/ai-chat", "/api/legal-ai", "/api/client-auth/login", "/api/storage/upload"];
const unprotected = criticalPaths.filter(p => !rateLimitPaths.includes(p) && !appSrc.includes(p + '"'));

info(`${rateLimitPaths.length} مسار محمي بـ Rate Limiting`);

if (unprotected.length === 0) {
  pass(`جميع المسارات الحساسة الـ ${criticalPaths.length} محمية بـ Rate Limiter`);
  recordResult("api", true, 0);
} else {
  unprotected.forEach(p => fail(`مسار حساس بدون Rate Limit: ${p}`));
  recordResult("api", false, unprotected.length);
}

// Check security headers
if (appSrc.includes("helmet(")) pass("Helmet headers مفعّلة");
else fail("Helmet غير موجود");

if (appSrc.includes("IsolationMiddleware")) pass("IsolationMiddleware مفعّل");
else fail("IsolationMiddleware غير موجود");

if (appSrc.includes("runtimeShield")) pass("Runtime Shield مفعّل");
else warn("runtimeShield غير موجود");

/* ═════════════════════════════════════════════════════════
   9. Tenant Security Foundation (Phase 1)
═════════════════════════════════════════════════════════ */
head("9/9 Tenant Security Foundation");
let tenantSecIssues = 0;
let tenantSecWarnings = 0;

const reqAuthTenantSrc = readSrc(BACKEND, "src/middlewares/requireAuth.ts") ?? "";
const tenantMwCompatSrc = readSrc(BACKEND, "src/middlewares/tenantMiddleware.ts") ?? "";
const tenantResSrc = readSrc(BACKEND, "src/middlewares/tenantResolution.ts") ?? "";

if ((tenantMwCompatSrc.match(/export async function requireAuthWithTenant\s*\(/g) ?? []).length > 0) {
  fail("تكرار تنفيذ requireAuthWithTenant في tenantMiddleware.ts");
  tenantSecIssues++;
} else {
  pass("requireAuthWithTenant — تنفيذ واحد في requireAuth.ts");
}

if (tenantMwCompatSrc.includes('export { requireAuthWithTenant } from "./requireAuth"')) {
  pass("tenantMiddleware — طبقة توافق (re-export)");
} else {
  warn("tenantMiddleware لا يعيد تصدير requireAuthWithTenant");
  tenantSecWarnings++;
}

if (tenantResSrc.includes("tenantKernel")) {
  pass("tenant kernel — canonical resolver (tenantKernel.ts)");
} else {
  warn("tenantKernel.ts غير مؤكد في tenantResolution shim");
  tenantSecWarnings++;
}

const kernelSrc = readSrc(BACKEND, "src/core/tenant/tenantKernel.ts") ?? "";
if (kernelSrc.includes("resolveTenantContext") && !kernelSrc.includes("TENANT-HEAL-7") && !kernelSrc.includes("SELECT office_id FROM users")) {
  pass("tenant kernel — لا TENANT-HEAL-7 ولا users.office_id fallback");
} else {
  fail("tenantKernel ناقص أو يحتوي fallback خطير");
  tenantSecIssues++;
}

const lifecycleSrc = readSrc(BACKEND, "src/core/tenant/tenantLifecycle.ts") ?? "";
if (lifecycleSrc.includes("assertTenantActive") && lifecycleSrc.includes("lifecycle_status")) {
  pass("tenant lifecycle — persistent freeze/suspend");
} else {
  warn("tenantLifecycle غير مكتمل");
  tenantSecWarnings++;
}

const reqAuthSrc = readSrc(BACKEND, "src/middlewares/requireAuth.ts") ?? "";
if (reqAuthSrc.includes("assertTenantActive")) {
  pass("requireAuthWithTenant — lifecycle gate");
} else {
  fail("requireAuthWithTenant بدون lifecycle check");
  tenantSecIssues++;
}

const eventBusTenantSrc = readSrc(BACKEND, "src/core/eventBus.ts") ?? "";
if (!eventBusTenantSrc.includes('?? "default"') && eventBusTenantSrc.includes("missing officeId")) {
  pass("eventBus — لا default tenant على persist");
} else {
  warn("eventBus قد يستخدم default tenant");
  tenantSecWarnings++;
}

const listenerFiles = [
  "src/core/listeners/notificationListener.ts",
  "src/core/listeners/analyticsListener.ts",
  "src/core/listeners/autopilotListener.ts",
  "src/core/listeners/financeListener.ts",
];
let listenerFallbacks = 0;
for (const rel of listenerFiles) {
  const src = readSrc(BACKEND, rel) ?? "";
  if (src.includes('?? "default"')) {
    fail(`${rel}: event listener يستخدم default tenant fallback`);
    tenantSecIssues++;
    listenerFallbacks++;
  }
}
if (listenerFallbacks === 0) {
  pass("event listeners — fail-closed (لا ?? default)");
}

const lifecycleBootSrc = readSrc(BACKEND, "src/core/tenant/tenantLifecycle.ts") ?? "";
if (lifecycleBootSrc.includes("bootLifecycleCache")) {
  pass("tenant lifecycle — boot cache sync");
} else {
  warn("bootLifecycleCache غير موجود");
  tenantSecWarnings++;
}

if (tenantResSrc.includes("export async function resolveTenantId") || tenantResSrc.includes("resolveTenantId")) {
  pass("resolveTenantId منفصل في tenantResolution.ts");
} else {
  fail("tenantResolution.ts مفقود أو غير مكتمل");
  tenantSecIssues++;
}

const p0Routes = [
  ["entitlements", "src/modules/platform/entitlements.ts", [/requireAuthWithTenant/, /getRequiredTenantId/]],
  ["copilot /chat", "src/modules/ai/copilot.ts", [/router\.post\("\/chat", requireAuthWithTenant/]],
  ["AI gateway /ai/query", "src/modules/ai/aiGateway.ts", [/router\.post\("\/ai\/query", requireAuthWithTenant/, /getRequiredTenantId/]],
  ["internal-messages", "src/modules/operations/internal-messages.ts", [/m\.office_id = \$\{tenantId\}/, /requireAuthWithTenant/]],
];

for (const [label, rel, patterns] of p0Routes) {
  const src = readSrc(BACKEND, rel) ?? "";
  const ok = patterns.every((p) => p.test(src));
  if (ok) pass(`P0 محكم: ${label}`);
  else {
    fail(`P0 غير محكم: ${label}`);
    tenantSecIssues++;
  }
}

const unsafeFallbackPatterns = [
  [/tenantId\s*\?\?\s*\(req as any\)\.userId/, "tenantId ?? userId"],
  [/tenantId\s*\?\?\s*[^\n]*userId[^\n]*\?\?\s*["']unknown["']/, "tenantId ?? userId ?? unknown"],
  [/getTenantSafe\(\)\?\.officeId\s*\?\?\s*["']default["']/, "getTenantSafe()?.officeId ?? default"],
  [/return\s*["']default["']\s*;.*single-tenant/is, "hardcoded return default"],
];

const criticalTenantFiles = [
  "src/modules/platform/entitlements.ts",
  "src/modules/platform/managedIntegrations.ts",
  "src/modules/ai/copilot.ts",
  "src/modules/ai/aiGateway.ts",
  "src/modules/ai/aiProviderEngine.ts",
  "src/modules/ai/aiCredits.ts",
  "src/copilot/tool.registry.ts",
  "src/modules/operations/internal-messages.ts",
  "src/modules/integrations/push.ts",
  "src/webhookHandlers.ts",
];

let fallbackHits = 0;
for (const rel of criticalTenantFiles) {
  const src = readSrc(BACKEND, rel) ?? "";
  for (const [re, label] of unsafeFallbackPatterns) {
    if (re.test(src)) {
      fail(`${rel}: fallback غير آمن (${label})`);
      tenantSecIssues++;
      fallbackHits++;
    }
  }
}
if (fallbackHits === 0) pass("لا أنماط tenant fallback حرجة في مسارات P0");

if (reqAuthTenantSrc.includes("TNT_403") || reqAuthTenantSrc.includes("tenantRequiredResponse")) {
  pass("استجابة TNT_403 موحّدة لمسارات tenant-required");
} else {
  warn("TNT_403 response helper غير مؤكد في requireAuth.ts");
  tenantSecWarnings++;
}

recordResult("tenant_security", tenantSecIssues === 0, tenantSecIssues, tenantSecWarnings);

/* ═════════════════════════════════════════════════════════
   10. Authorization Foundation (Phase 2 — warn mode)
═════════════════════════════════════════════════════════ */
head("10/10 Authorization Foundation");
let authzIssues = 0;
let authzWarnings = 0;

const authzKernelFiles = [
  "src/core/authorization/permissionCatalog.ts",
  "src/core/authorization/authorizationContext.ts",
  "src/core/authorization/authorize.ts",
  "src/core/authorization/routePolicyRegistry.ts",
  "src/core/authorization/enforceRoutePolicy.ts",
  "src/core/authorization/errors.ts",
];

for (const rel of authzKernelFiles) {
  if (existsSync(resolve(BACKEND, rel))) pass(`kernel: ${rel.split("/").pop()}`);
  else {
    fail(`kernel مفقود: ${rel}`);
    authzIssues++;
  }
}

const reqAuthSrc2 = readSrc(BACKEND, "src/middlewares/requireAuth.ts") ?? "";
if (reqAuthSrc2.includes("ensureAuthorizationContext") && reqAuthSrc2.includes("membershipRequiredResponse")) {
  pass("requirePermission يستخدم Authorization Kernel");
} else {
  fail("requirePermission لم يُرحَّل إلى kernel");
  authzIssues++;
}

if (!/trainee_lawyer/.test(reqAuthSrc2) || reqAuthSrc2.includes("membershipRequiredResponse")) {
  pass("لا fallback trainee_lawyer في requirePermission");
} else {
  warn("fallback trainee_lawyer قد يزال موجوداً");
  authzWarnings++;
}

const rbacSrc = readSrc(BACKEND, "src/modules/platform/rbac.ts") ?? "";
if (rbacSrc.includes("core/authorization") && rbacSrc.includes("office_members SET role")) {
  pass("rbac: office_members.role مصدر الكتابة");
} else {
  warn("rbac: تحقق من مصدر role writes");
  authzWarnings++;
}

if (/usersTable\)\s*[\s\S]*\.set\(\{\s*role/.test(rbacSrc)) {
  warn("rbac: كتابة users.role ما زالت موجودة");
  authzWarnings++;
} else {
  pass("لا كتابة users.role في rbac");
}

if (rbacSrc.includes("officeId") && rbacSrc.includes("invitationsTable")) {
  pass("invitations scoped بـ office_id");
} else {
  warn("invitations.office_id غير مؤكد في rbac");
  authzWarnings++;
}

const policySrc = readSrc(BACKEND, "src/core/authorization/routePolicyRegistry.ts") ?? "";
if (policySrc.includes("TENANT_RBAC") && policySrc.includes("routeClass")) {
  pass("routeClass taxonomy في registry");
} else {
  fail("routePolicyRegistry ناقص");
  authzIssues++;
}

const migrationExists = existsSync(resolve(ROOT, "lib/db/drizzle/0001_invitations_office_id.sql"));
if (migrationExists) pass("migration invitations.office_id موجودة");
else {
  warn("migration 0001_invitations_office_id مفقودة");
  authzWarnings++;
}

const enforcementModules = [
  "src/modules/legal-core/cases.ts",
  "src/modules/legal-core/clients.ts",
  "src/modules/legal-core/contracts.ts",
  "src/modules/legal-core/documents.ts",
  "src/modules/financial/invoices.ts",
  "src/modules/financial/accounting.ts",
  "src/modules/financial/payments.ts",
  "src/modules/operations/hr.ts",
];
let unguardedMutations = 0;
const mutationLineRe = /router\.(post|put|patch|delete)\([^)]+\)[^{]*async/gi;
for (const rel of enforcementModules) {
  const src = readSrc(BACKEND, rel) ?? "";
  const lines = src.split("\n").filter((l) => /router\.(post|put|patch|delete)\(/.test(l));
  const unguarded = lines.filter((l) => !l.includes("requirePermission(") && !l.includes("/webhook/"));
  if (unguarded.length > 0) {
    fail(`${rel}: ${unguarded.length} mutation(s) بدون requirePermission`);
    authzIssues++;
    unguardedMutations += unguarded.length;
  }
}
if (unguardedMutations === 0) {
  pass(`authz P0 (${enforcementModules.length} modules) — جميع mutations محمية`);
}

recordResult("authorization", authzIssues === 0, authzIssues, authzWarnings);

/* ═════════════════════════════════════════════════════════
   Route Governance (existing check)
═════════════════════════════════════════════════════════ */
head("+ Route Governance (للتأكيد)");
const routeRegExists = existsSync(resolve(FRONTEND, "src/lib/routeRegistry.ts"));
const validateScriptExists = existsSync(resolve(FRONTEND, "scripts/validate-routes.mjs"));
if (routeRegExists) pass("routeRegistry.ts موجود");
else fail("routeRegistry.ts مفقود");
if (validateScriptExists) pass("validate-routes.mjs موجود");
else fail("validate-routes.mjs مفقود");

/* ═════════════════════════════════════════════════════════
   SUMMARY
═════════════════════════════════════════════════════════ */
console.log(`\n${C.BOLD}${"═".repeat(55)}${C.RESET}`);
console.log(`${C.BOLD}  Platform Governance Report — عدالة AI${C.RESET}`);
console.log(`${"═".repeat(55)}`);

const layers = [
  ["Permissions Registry",    "permissions"],
  ["Feature Flags Registry",  "features"],
  ["Events Registry",         "events"],
  ["AI Registry",             "ai"],
  ["Integrations Registry",   "integrations"],
  ["Background Jobs Registry","jobs"],
  ["DB Registry",             "db"],
  ["API Layer",               "api"],
  ["Tenant Security",         "tenant_security"],
  ["Authorization Foundation","authorization"],
];

let criticalFails = 0;
for (const [label, key] of layers) {
  const r = results[key] ?? { passed: false, issues: 1, warnings: 0 };
  const icon = r.issues > 0 ? `${C.RED}❌` : r.warnings > 0 ? `${C.YELLOW}⚠️ ` : `${C.GREEN}✅`;
  const detail = r.issues > 0 ? ` (${r.issues} مشكلة)` : r.warnings > 0 ? ` (${r.warnings} تحذير)` : "";
  console.log(`  ${icon} ${label.padEnd(28)}${detail}${C.RESET}`);
  if (r.issues > 0) criticalFails++;
}

console.log();
if (criticalFails === 0 && totalIssues === 0) {
  console.log(`${C.BOLD}${C.GREEN}🎉 Platform Governance: PASS${C.RESET}`);
  console.log(`${C.GREEN}   جميع طبقات المنصة الـ 10 محكومة ومفحوصة${C.RESET}`);
  if (totalWarnings > 0) console.log(`${C.YELLOW}   تحذيرات: ${totalWarnings} (غير حرجة)${C.RESET}`);
  console.log();
  process.exit(0);
} else {
  console.log(`${C.BOLD}${C.RED}🚨 Platform Governance: FAIL${C.RESET}`);
  console.log(`${C.RED}   مشاكل حرجة: ${totalIssues} | تحذيرات: ${totalWarnings}${C.RESET}`);
  console.log();
  process.exit(1);
}
