/**
 * Pure authorization evaluation — no Express, no SQL.
 */
import type { AuthorizationContext, AuthorizeResult, ResourceContext } from "./types";

export function hasPermission(
  ctx: Pick<AuthorizationContext, "permissions">,
  permission: string,
): boolean {
  const { permissions } = ctx;
  if (permissions.includes("*")) return true;
  return permissions.includes(permission);
}

export function hasAnyPermission(
  ctx: Pick<AuthorizationContext, "permissions">,
  permissions: string[],
): boolean {
  return permissions.some((p) => hasPermission(ctx, p));
}

export function hasAllPermissions(
  ctx: Pick<AuthorizationContext, "permissions">,
  permissions: string[],
): boolean {
  return permissions.every((p) => hasPermission(ctx, p));
}

/**
 * Authorize an action against loaded context.
 * @param resource — reserved for Phase 3 ABAC; ignored in PR-AUTH-001.
 */
export function authorize(
  ctx: AuthorizationContext,
  action: string,
  _resource?: ResourceContext,
): AuthorizeResult {
  if (hasPermission(ctx, action)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `missing permission: ${action}`,
  };
}
