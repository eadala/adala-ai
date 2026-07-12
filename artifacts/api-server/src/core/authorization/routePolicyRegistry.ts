/**
 * Route policy registry — maps normalized API paths to required permissions.
 * PR-AUTH-001: seed policies for routes already using requirePermission + RBAC admin.
 * PR-AUTH-002+ will expand coverage; governance warns on unregistered mutations.
 */
import type { RouteClass } from "./types";

export interface RoutePolicy {
  method: string;
  /** Normalized path e.g. /api/cases/:id */
  path: string;
  routeClass: RouteClass;
  permission?: string;
  permissions?: string[];
  match?: "any" | "all";
  description?: string;
}

/** Policies registered in PR-AUTH-001 (reference + RBAC module). */
export const ROUTE_POLICIES: RoutePolicy[] = [
  // legal-core — already guarded deletes
  { method: "DELETE", path: "/api/cases/:id", routeClass: "TENANT_RBAC", permission: "cases:delete" },
  { method: "DELETE", path: "/api/clients/:id", routeClass: "TENANT_RBAC", permission: "clients:delete" },
  // financial
  { method: "DELETE", path: "/api/invoices/:id", routeClass: "TENANT_RBAC", permission: "invoices:delete" },
  { method: "DELETE", path: "/api/accounting/revenues/:id", routeClass: "TENANT_RBAC", permission: "accounting:delete" },
  { method: "DELETE", path: "/api/accounting/expenses/:id", routeClass: "TENANT_RBAC", permission: "accounting:delete" },
  { method: "DELETE", path: "/api/accounting/bank-accounts/:id", routeClass: "TENANT_RBAC", permission: "accounting:delete" },
  { method: "DELETE", path: "/api/accounting/advances/:id", routeClass: "TENANT_RBAC", permission: "accounting:delete" },
  // HR / payroll
  { method: "GET", path: "/api/hr/payroll", routeClass: "TENANT_RBAC", permission: "payroll:view" },
  { method: "GET", path: "/api/hr/payroll/stats", routeClass: "TENANT_RBAC", permission: "payroll:view" },
  { method: "POST", path: "/api/hr/payroll/generate", routeClass: "TENANT_RBAC", permission: "payroll:manage" },
  { method: "PATCH", path: "/api/hr/payroll/:id/pay", routeClass: "TENANT_RBAC", permission: "payroll:manage" },
  { method: "PATCH", path: "/api/hr/payroll/pay-all", routeClass: "TENANT_RBAC", permission: "payroll:manage" },
  { method: "POST", path: "/api/hr/attendance", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr/office-location", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  // RBAC admin
  { method: "POST", path: "/api/rbac/roles", routeClass: "TENANT_RBAC", permission: "roles:create" },
  { method: "PATCH", path: "/api/rbac/roles/:id", routeClass: "TENANT_RBAC", permission: "roles:edit" },
  { method: "DELETE", path: "/api/rbac/roles/:id", routeClass: "TENANT_RBAC", permission: "roles:edit" },
  { method: "POST", path: "/api/rbac/invitations", routeClass: "TENANT_RBAC", permission: "users:create" },
  { method: "DELETE", path: "/api/rbac/invitations/:id", routeClass: "TENANT_RBAC", permission: "users:create" },
  { method: "PATCH", path: "/api/rbac/members/:memberId/role", routeClass: "TENANT_RBAC", permission: "users:edit" },
  { method: "DELETE", path: "/api/rbac/members/:memberId", routeClass: "TENANT_RBAC", permission: "users:delete" },
  { method: "PATCH", path: "/api/rbac/users/:id/status", routeClass: "TENANT_RBAC", permission: "users:edit" },
  { method: "GET", path: "/api/rbac/audit-logs", routeClass: "TENANT_RBAC", permission: "audit:view" },
];

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Normalize request path to /api/... form for registry lookup.
 */
export function normalizeApiPath(originalUrl: string): string {
  const withoutQuery = originalUrl.split("?")[0] ?? originalUrl;
  const path = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (path.startsWith("/api")) return path;
  return `/api${path}`;
}

/** Match Express-style :param segments. */
function pathMatches(pattern: string, actual: string): boolean {
  const patternParts = pattern.split("/").filter(Boolean);
  const actualParts = actual.split("/").filter(Boolean);
  if (patternParts.length !== actualParts.length) return false;
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const ap = actualParts[i];
    if (pp.startsWith(":")) continue;
    if (pp !== ap) return false;
  }
  return true;
}

export function findRoutePolicy(method: string, normalizedPath: string): RoutePolicy | undefined {
  const m = method.toUpperCase();
  if (!METHODS.has(m)) return undefined;
  return ROUTE_POLICIES.find(
    (p) => p.method === m && pathMatches(p.path, normalizedPath),
  );
}

export function listPoliciesForRouteClass(routeClass: RouteClass): RoutePolicy[] {
  return ROUTE_POLICIES.filter((p) => p.routeClass === routeClass);
}
