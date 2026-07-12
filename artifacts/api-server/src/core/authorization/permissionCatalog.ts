/**
 * Permission Catalog — single source of truth for RBAC permission keys.
 * Import from here; do not duplicate permission strings in domain modules.
 */

export const ALL_PERMISSIONS = [
  // Cases
  "cases:view", "cases:create", "cases:edit", "cases:delete", "cases:assign", "cases:close",
  // Clients
  "clients:view", "clients:create", "clients:edit", "clients:delete",
  // Contracts
  "contracts:view", "contracts:create", "contracts:edit", "contracts:delete",
  // Documents
  "documents:view", "documents:upload", "documents:edit", "documents:delete",
  // Financial
  "invoices:view", "invoices:create", "invoices:edit", "invoices:delete",
  "payments:view", "payments:create",
  "reports:view", "financial:view",
  // Payroll
  "payroll:view", "payroll:manage",
  // Accounting destructive ops
  "accounting:delete",
  // Users & Roles
  "users:view", "users:create", "users:edit", "users:delete",
  "roles:view", "roles:create", "roles:edit",
  // Settings
  "settings:view", "settings:edit",
  // AI
  "ai:access",
  // Messaging
  "messages:view", "messages:send",
  // Support
  "support:view", "support:reply",
  // Referral & Collaboration
  "referral:create", "referral:view",
  "collaborator:access",
  // Audit
  "audit:view",
  // Dashboard
  "dashboard:view",
  // HR
  "hr:manage",
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSIONS);

export function isValidPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_KEY_SET.has(key);
}

/** Frontend registry uses some alias keys — map for governance sync. */
export const FRONTEND_PERMISSION_ALIASES: Record<string, string> = {
  "cases:manage": "cases:edit",
  "clients:manage": "clients:edit",
  "users:manage": "users:edit",
  "settings:manage": "settings:edit",
  "financial:manage": "financial:view",
  "reports:export": "reports:view",
};
