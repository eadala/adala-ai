/**
 * Adala SaaS Kernel — Tenant Context
 *
 * Uses Node AsyncLocalStorage so tenant identity flows through the entire
 * call stack without prop-drilling `req.tenantId` everywhere.
 *
 * Usage:
 *   - In middleware: runWithTenant({ userId, officeId }, () => next())
 *   - Anywhere in the stack: const { officeId } = getTenant()
 *   - Route handlers: getRequiredTenantId(req) — fail-closed, no fallbacks
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  userId:   string;
  officeId: string;
}

/** Synthetic tenant for super-admin platform routes — not a real office */
export const PLATFORM_TENANT_ID = "platform";

/** Banned runtime tenant identifiers (never use as office_id) */
export const FORBIDDEN_TENANT_IDS = new Set(["default", "unknown"]);

export const TENANT_REQUIRED_CODE = "TNT_403" as const;

export class TenantRequiredError extends Error {
  readonly code = TENANT_REQUIRED_CODE;

  constructor(message = "سياق المكتب مطلوب ولم يتم التحقق منه") {
    super(message);
    this.name = "TenantRequiredError";
  }
}

export const TenantStorage = new AsyncLocalStorage<TenantContext>();

/** Dev-only escape hatch for legacy single-office workflows — never in production */
export function allowLegacyDefaultTenant(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LEGACY_DEFAULT_TENANT === "true"
  );
}

/**
 * True when officeId is a real tenant (not platform synthetic, not banned fallback).
 */
export function isRealOfficeTenantId(
  officeId: string | null | undefined,
): officeId is string {
  if (!officeId || officeId === PLATFORM_TENANT_ID) return false;
  if (FORBIDDEN_TENANT_IDS.has(officeId)) return false;
  return officeId.length > 0;
}

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
 * Prefer getTenant() / getRequiredOfficeId() for mutation paths.
 */
export function getTenantSafe(): TenantContext | null {
  return TenantStorage.getStore() ?? null;
}

/**
 * Validated office ID from AsyncLocalStorage — for copilot tools and services.
 * Throws TenantRequiredError when context is missing or uses a banned fallback.
 */
export function getRequiredOfficeId(): string {
  const store = getTenantSafe();
  if (store && isRealOfficeTenantId(store.officeId)) return store.officeId;
  if (allowLegacyDefaultTenant()) return "default";
  throw new TenantRequiredError(
    "عملية تتطلب سياق مكتب صالح — تأكد من requireAuthWithTenant على المسار",
  );
}

/**
 * Validated tenant from Express request (set by requireAuthWithTenant).
 * Rejects default / unknown / userId substitutes.
 */
export function getRequiredTenantId(req: unknown): string {
  const tenantId = (req as { tenantId?: string }).tenantId;
  if (isRealOfficeTenantId(tenantId)) return tenantId;
  if (allowLegacyDefaultTenant()) return "default";
  throw new TenantRequiredError();
}

/** Type guard assertion for route handlers */
export function assertTenantContext(
  req: unknown,
): asserts req is { tenantId: string } {
  getRequiredTenantId(req);
}

/** HTTP 403 body for missing tenant — shared by middleware and handlers */
export function tenantRequiredResponse(userId?: string) {
  return {
    error: "لا يمكن تحديد المكتب. تأكد من اكتمال إعداد الحساب.",
    code: TENANT_REQUIRED_CODE,
    ...(userId ? { userId } : {}),
    hint: "أكمل عملية الإعداد الأولي، أو تواصل مع الدعم الفني إذا أتممت الإعداد مسبقاً.",
  };
}
