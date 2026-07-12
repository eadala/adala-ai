/**
 * Authorization kernel types — extension points for future ABAC / matter-level policy.
 */

/** Route classification taxonomy (platform-wide). */
export type RouteClass =
  | "PUBLIC"
  | "AUTHENTICATED"
  | "TENANT"
  | "TENANT_RBAC"
  | "WEBHOOK"
  | "SYSTEM"
  | "SUPER_ADMIN"
  | "BREAK_GLASS";

export type PrincipalType = "user" | "super_admin" | "impersonated" | "system" | "webhook";

/** Future ABAC hook — unused in PR-AUTH-001 enforcement. */
export interface ResourceContext {
  type: string;
  id?: string;
  attributes?: Record<string, unknown>;
}

export interface AuthorizationContext {
  userId: string;
  officeId: string;
  roleName: string;
  roleDisplayName: string;
  permissions: string[];
  principalType: PrincipalType;
  /** True only for platform super-admin without active impersonation. */
  isSuperAdmin: boolean;
  isImpersonating: boolean;
}

export interface AuthorizeResult {
  allowed: boolean;
  reason?: string;
}
