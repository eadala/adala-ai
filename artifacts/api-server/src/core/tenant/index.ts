export {
  resolveTenantContext,
  resolveTenantId,
  invalidateTenantCache,
  logTenantResolution,
  type ResolvedTenantContext,
} from "./tenantKernel";

export {
  assertTenantActive,
  bootLifecycleCache,
  ensureTenantLifecycleSchema,
  getLifecycleBlockedOffices,
  getTenantLifecycleStatus,
  isOfficeLifecycleBlocked,
  setTenantLifecycle,
  TenantLifecycleError,
  tenantLifecycleResponse,
  type TenantLifecycleStatus,
} from "./tenantLifecycle";

export { requireEventOfficeId } from "./eventScope";
export { runAsSystemTenant, SYSTEM_ACTOR_ID } from "./backgroundScope";
export {
  withTenantRls,
  withPlatformRlsBypass,
  setRlsSession,
  clearRlsSession,
} from "./rlsScope";
export { validateRlsPolicies, bootRlsValidation, RLS_P0_TABLES } from "./rlsValidation";

export {
  resolveTenantWithTrace,
  auditTenantResolution,
  type TenantResolutionTrace,
  type TenantSource,
} from "./tenantResolver";

export { bindTenant, recoverIdentity, getBindingHistory } from "./tenantVersioning";
