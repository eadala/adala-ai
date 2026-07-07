/**
 * Canonical tenant data access layer (PR-DATA-001).
 */
export {
  tenantDB,
  tenantFilter,
  tenantAnd,
  guardRawSQL,
} from "../tenantDb";

export {
  getRequiredOfficeId,
  getRequiredTenantId,
  getTenant,
  getTenantSafe,
  runWithTenant,
  isRealOfficeTenantId,
  FORBIDDEN_TENANT_IDS,
  PLATFORM_TENANT_ID,
} from "../tenantContext";

export {
  withTenantRls,
  withPlatformRlsBypass,
  setRlsSession,
  clearRlsSession,
} from "./rlsScope";

export { validateRlsPolicies, bootRlsValidation, RLS_P0_TABLES } from "./rlsValidation";

export { runAsSystemTenant, SYSTEM_ACTOR_ID } from "./backgroundScope";
