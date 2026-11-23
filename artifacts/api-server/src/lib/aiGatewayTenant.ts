/**
 * Fail-closed tenant resolution for the AI gateway.
 *
 * Never fall back to Clerk userId or the literal "unknown" — those caused
 * cross-tenant cache keys and unscoped analytics filters.
 *
 * Rejects synthetic "platform" tenant for firm-scoped AI work.
 */

export type AiGatewayTenantRequest = {
  tenantId?: unknown;
  /** Prefer isSuperAdmin (set by requireAuthWithTenant / requireSuperAdmin). */
  isSuperAdmin?: unknown;
  /** Legacy alias — only trusted if middleware set it; do not accept from body. */
  isAdmin?: unknown;
};

function isPrivilegedAdmin(req: AiGatewayTenantRequest): boolean {
  return req.isSuperAdmin === true || req.isAdmin === true;
}

/** Canonical office UUID from request tenant context, or null if absent/invalid. */
export function resolveAiGatewayOfficeId(req: AiGatewayTenantRequest): string | null {
  const raw = req.tenantId;
  if (typeof raw !== "string") return null;
  const officeId = raw.trim();
  if (!officeId || officeId === "unknown" || officeId === "platform") return null;
  return officeId;
}

/**
 * For tenant-scoped AI routes: require an office id.
 * Returns reject=true when the caller must be denied.
 * Super-admins may proceed without an office id for aggregate analytics only.
 */
export function requireAiGatewayOfficeId(
  req: AiGatewayTenantRequest,
  opts: { allowAdminWithoutTenant?: boolean } = {},
): { officeId: string | null; reject: boolean } {
  const officeId = resolveAiGatewayOfficeId(req);
  if (officeId) return { officeId, reject: false };
  if (opts.allowAdminWithoutTenant && isPrivilegedAdmin(req)) {
    return { officeId: null, reject: false };
  }
  return { officeId: null, reject: true };
}

/** Server-side admin flag for analytics scoping (never trust client body). */
export function isAiGatewayAdmin(req: AiGatewayTenantRequest): boolean {
  return isPrivilegedAdmin(req);
}
