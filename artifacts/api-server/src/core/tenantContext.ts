/**
 * Adala SaaS Kernel — Tenant Context
 *
 * Uses Node AsyncLocalStorage so tenant identity flows through the entire
 * call stack without prop-drilling `req.tenantId` everywhere.
 *
 * Usage:
 *   - In middleware: runWithTenant({ userId, officeId }, () => next())
 *   - Anywhere in the stack: const { officeId } = getTenant()
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  userId:   string;
  officeId: string;
}

export const TenantStorage = new AsyncLocalStorage<TenantContext>();

/** Wrap a callback so all async work inside sees the tenant context */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return TenantStorage.run(ctx, fn);
}

/**
 * Read the current tenant — throws if called outside a tenant-bound request.
 * Use this in services/helpers that must be scoped.
 */
export function getTenant(): TenantContext {
  const store = TenantStorage.getStore();
  if (!store) {
    throw new Error(
      "NO_TENANT_CONTEXT: getTenant() called outside a tenant-bound request. " +
      "Ensure requireAuthWithTenant middleware is applied to this route."
    );
  }
  return store;
}

/**
 * Safe variant — returns null instead of throwing.
 * Use in shared utilities that may be called from both tenant and non-tenant contexts.
 */
export function getTenantSafe(): TenantContext | null {
  return TenantStorage.getStore() ?? null;
}
