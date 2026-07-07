/**
 * Tenant resolution — compatibility shim (PR-TNT-002).
 * Canonical implementation: core/tenant/tenantKernel.ts
 */
export {
  resolveTenantId,
  resolveTenantContext,
  invalidateTenantCache,
  logTenantResolution,
} from "../core/tenant/tenantKernel";
