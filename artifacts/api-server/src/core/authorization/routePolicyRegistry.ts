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

/** Policies — PR-AUTH-001 RBAC + PR-AUTH-002 legal-core. */
export const ROUTE_POLICIES: RoutePolicy[] = [
  // ── cases ──
  { method: "GET", path: "/api/cases", routeClass: "TENANT_RBAC", permission: "cases:view" },
  { method: "GET", path: "/api/cases/stats", routeClass: "TENANT_RBAC", permission: "cases:view" },
  { method: "POST", path: "/api/cases", routeClass: "TENANT_RBAC", permission: "cases:create" },
  { method: "GET", path: "/api/cases/:id", routeClass: "TENANT_RBAC", permission: "cases:view" },
  { method: "PATCH", path: "/api/cases/:id", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "DELETE", path: "/api/cases/:id", routeClass: "TENANT_RBAC", permission: "cases:delete" },
  { method: "DELETE", path: "/api/cases/:id/hard", routeClass: "TENANT_RBAC", permission: "cases:delete" },
  { method: "POST", path: "/api/cases/:id/timeline", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "POST", path: "/api/cases/:id/messages", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "POST", path: "/api/cases/:id/tasks", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "POST", path: "/api/cases/:id/autopilot", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "POST", path: "/api/cases/:id/analyze", routeClass: "TENANT_RBAC", permission: "ai:access" },
  { method: "PATCH", path: "/api/cases/:id/court", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "POST", path: "/api/cases/:id/hearings", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "PATCH", path: "/api/cases/:id/hearings/:hid", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "DELETE", path: "/api/cases/:id/hearings/:hid", routeClass: "TENANT_RBAC", permission: "cases:edit" },
  { method: "POST", path: "/api/cases/:id/documents", routeClass: "TENANT_RBAC", permission: "documents:upload" },
  { method: "DELETE", path: "/api/cases/:id/documents/:did", routeClass: "TENANT_RBAC", permission: "documents:delete" },
  // ── clients ──
  { method: "GET", path: "/api/clients", routeClass: "TENANT_RBAC", permission: "clients:view" },
  { method: "POST", path: "/api/clients", routeClass: "TENANT_RBAC", permission: "clients:create" },
  { method: "PATCH", path: "/api/clients/:id", routeClass: "TENANT_RBAC", permission: "clients:edit" },
  { method: "DELETE", path: "/api/clients/:id", routeClass: "TENANT_RBAC", permission: "clients:delete" },
  // ── contracts ──
  { method: "POST", path: "/api/contracts", routeClass: "TENANT_RBAC", permission: "contracts:create" },
  { method: "PATCH", path: "/api/contracts/:id", routeClass: "TENANT_RBAC", permission: "contracts:edit" },
  { method: "DELETE", path: "/api/contracts/:id", routeClass: "TENANT_RBAC", permission: "contracts:delete" },
  { method: "POST", path: "/api/contracts/:id/analyze", routeClass: "TENANT_RBAC", permission: "ai:access" },
  { method: "POST", path: "/api/contracts/generate-from-prompt", routeClass: "TENANT_RBAC", permission: "contracts:create" },
  // ── documents ──
  { method: "GET", path: "/api/documents", routeClass: "TENANT_RBAC", permission: "documents:view" },
  { method: "POST", path: "/api/documents", routeClass: "TENANT_RBAC", permission: "documents:upload" },
  { method: "DELETE", path: "/api/documents/:id", routeClass: "TENANT_RBAC", permission: "documents:delete" },
  // ── financial: invoices ──
  { method: "GET", path: "/api/invoices", routeClass: "TENANT_RBAC", permission: "invoices:view" },
  { method: "GET", path: "/api/invoices/:id", routeClass: "TENANT_RBAC", permission: "invoices:view" },
  { method: "POST", path: "/api/invoices", routeClass: "TENANT_RBAC", permission: "invoices:create" },
  { method: "PUT", path: "/api/invoices/:id", routeClass: "TENANT_RBAC", permission: "invoices:edit" },
  { method: "DELETE", path: "/api/invoices/:id", routeClass: "TENANT_RBAC", permission: "invoices:delete" },
  { method: "GET", path: "/api/invoices/:id/payments", routeClass: "TENANT_RBAC", permission: "payments:view" },
  { method: "POST", path: "/api/invoices/:id/payments", routeClass: "TENANT_RBAC", permission: "payments:create" },
  { method: "DELETE", path: "/api/invoices/:id/payments/:pid", routeClass: "TENANT_RBAC", permission: "payments:create" },
  { method: "POST", path: "/api/invoices/:id/payment-link", routeClass: "TENANT_RBAC", permission: "invoices:edit" },
  { method: "POST", path: "/api/invoices/:id/mark-paid", routeClass: "TENANT_RBAC", permission: "payments:create" },
  { method: "POST", path: "/api/invoices/:id/send-email", routeClass: "TENANT_RBAC", permission: "invoices:edit" },
  // ── financial: accounting ──
  { method: "GET", path: "/api/accounting/revenues", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "POST", path: "/api/accounting/revenues", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "PUT", path: "/api/accounting/revenues/:id", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "DELETE", path: "/api/accounting/revenues/:id", routeClass: "TENANT_RBAC", permission: "accounting:delete" },
  { method: "GET", path: "/api/accounting/expenses", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "POST", path: "/api/accounting/expenses", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "PUT", path: "/api/accounting/expenses/:id", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "DELETE", path: "/api/accounting/expenses/:id", routeClass: "TENANT_RBAC", permission: "accounting:delete" },
  { method: "GET", path: "/api/accounting/bank-accounts", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "POST", path: "/api/accounting/bank-accounts", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "PUT", path: "/api/accounting/bank-accounts/:id", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "DELETE", path: "/api/accounting/bank-accounts/:id", routeClass: "TENANT_RBAC", permission: "accounting:delete" },
  { method: "GET", path: "/api/accounting/advances", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "POST", path: "/api/accounting/advances", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "PATCH", path: "/api/accounting/advances/:id/approve", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "PATCH", path: "/api/accounting/advances/:id/repay", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "DELETE", path: "/api/accounting/advances/:id", routeClass: "TENANT_RBAC", permission: "accounting:delete" },
  { method: "GET", path: "/api/accounting/reports/summary", routeClass: "TENANT_RBAC", permission: "financial:view" },
  { method: "GET", path: "/api/accounting/cashflow", routeClass: "TENANT_RBAC", permission: "financial:view" },
  // ── HR / payroll ──
  { method: "GET", path: "/api/hr/payroll", routeClass: "TENANT_RBAC", permission: "payroll:view" },
  { method: "GET", path: "/api/hr/payroll/stats", routeClass: "TENANT_RBAC", permission: "payroll:view" },
  { method: "POST", path: "/api/hr/payroll/generate", routeClass: "TENANT_RBAC", permission: "payroll:manage" },
  { method: "PATCH", path: "/api/hr/payroll/:id/pay", routeClass: "TENANT_RBAC", permission: "payroll:manage" },
  { method: "PATCH", path: "/api/hr/payroll/pay-all", routeClass: "TENANT_RBAC", permission: "payroll:manage" },
  { method: "POST", path: "/api/hr/attendance", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr/attendance/check-in", routeClass: "TENANT_RBAC", permission: "dashboard:view" },
  { method: "POST", path: "/api/hr/attendance/check-out", routeClass: "TENANT_RBAC", permission: "dashboard:view" },
  { method: "GET", path: "/api/hr/office-location", routeClass: "TENANT_RBAC", permission: "dashboard:view" },
  { method: "POST", path: "/api/hr/office-location", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr/employees", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr/employees", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr/employees/:id", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "DELETE", path: "/api/hr/employees/:id", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr/leaves", routeClass: "TENANT_RBAC", permission: "dashboard:view" },
  { method: "PATCH", path: "/api/hr/leaves/:id", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr/warnings", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr/investigations", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  // ── HR enterprise ──
  { method: "POST", path: "/api/hr-enterprise/authorize", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-enterprise/roles", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr-enterprise/roles", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr-enterprise/roles/:name/permissions", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-enterprise/members", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr-enterprise/members", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr-enterprise/members/:userId/role", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr-enterprise/members/:userId/suspend", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr-enterprise/members/:userId/activate", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-enterprise/workflows", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-enterprise/workflows/stats", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr-enterprise/workflows", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr-enterprise/workflows/:id/approve", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr-enterprise/workflows/:id/reject", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-enterprise/audit", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-enterprise/overview", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-enterprise/org-chart", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  // ── HR internal ──
  { method: "GET", path: "/api/hr-internal/announcements", routeClass: "TENANT_RBAC", permission: "dashboard:view" },
  { method: "GET", path: "/api/hr-internal/announcements/all", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr-internal/announcements", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "DELETE", path: "/api/hr-internal/announcements/:id", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-internal/requests", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr-internal/requests", routeClass: "TENANT_RBAC", permission: "dashboard:view" },
  { method: "PATCH", path: "/api/hr-internal/requests/:id", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "DELETE", path: "/api/hr-internal/requests/:id", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-internal/leave-balances", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr-internal/leave-balances/:employeeId", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-internal/payslip/:payrollId", routeClass: "TENANT_RBAC", permission: "payroll:view" },
  { method: "GET", path: "/api/hr-internal/dashboard", routeClass: "TENANT_RBAC", permission: "dashboard:view" },
  // ── HR performance ──
  { method: "GET", path: "/api/hr-perf/settings", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "PATCH", path: "/api/hr-perf/settings", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-perf/evaluations", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-perf/evaluations/:employeeId", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr-perf/evaluate", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "DELETE", path: "/api/hr-perf/evaluations/:id", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-perf/incentives", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "POST", path: "/api/hr-perf/incentives", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "DELETE", path: "/api/hr-perf/incentives/:id", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  { method: "GET", path: "/api/hr-perf/smart-payroll/preview", routeClass: "TENANT_RBAC", permission: "payroll:view" },
  { method: "GET", path: "/api/hr-perf/dashboard", routeClass: "TENANT_RBAC", permission: "hr:manage" },
  // ── payments (Customer Zero P0) ──
  { method: "GET", path: "/api/payments/transactions", routeClass: "TENANT_RBAC", permission: "payments:view" },
  { method: "POST", path: "/api/payments/transactions", routeClass: "TENANT_RBAC", permission: "payments:create" },
  { method: "PATCH", path: "/api/payments/transactions/:id/settle", routeClass: "TENANT_RBAC", permission: "payments:create" },
  { method: "DELETE", path: "/api/payments/transactions/:id", routeClass: "TENANT_RBAC", permission: "payments:create" },
  { method: "GET", path: "/api/rbac/roles", routeClass: "TENANT_RBAC", permission: "roles:view" },
  { method: "GET", path: "/api/rbac/members", routeClass: "TENANT_RBAC", permission: "users:view" },
  { method: "GET", path: "/api/rbac/invitations", routeClass: "TENANT_RBAC", permission: "users:view" },
  { method: "PATCH", path: "/api/rbac/invitations/:id/resend", routeClass: "TENANT_RBAC", permission: "users:create" },
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
