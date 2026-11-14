import type { ArcRole } from "./types.js";

/**
 * Centralized deny-by-default permission catalog.
 * deployment:execute is defined but NEVER granted in Phase 2A.
 */
export const PERMISSIONS = [
  "releases:read",
  "gates:read",
  "monitoring:read",
  "incidents:read",
  "backup:read",
  "github:read",
  "coolify:read",
  "overview:read",
  "audit:read",
  "approval:request",
  "approval:decide",
  "deployment:request",
  "deployment:execute",
  "policy:modify",
  "roles:modify",
  "credentials:modify",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<ArcRole, readonly Permission[]> = {
  platform_owner: [
    "releases:read",
    "gates:read",
    "monitoring:read",
    "incidents:read",
    "backup:read",
    "github:read",
    "coolify:read",
    "overview:read",
    "audit:read",
    "approval:request",
    /* decide reserved for independent_reviewer */
    "deployment:request",
    /* deployment:execute NEVER in Phase 2A */
  ],
  release_manager: [
    "releases:read",
    "gates:read",
    "monitoring:read",
    "incidents:read",
    "backup:read",
    "github:read",
    "coolify:read",
    "overview:read",
    "audit:read",
    "approval:request",
    "deployment:request",
  ],
  independent_reviewer: [
    "releases:read",
    "gates:read",
    "monitoring:read",
    "incidents:read",
    "backup:read",
    "github:read",
    "coolify:read",
    "overview:read",
    "audit:read",
    "approval:decide",
  ],
  production_operator: [
    "releases:read",
    "gates:read",
    "monitoring:read",
    "incidents:read",
    "backup:read",
    "github:read",
    "coolify:read",
    "overview:read",
    "approval:request",
    "deployment:request",
    /* execute NEVER granted */
  ],
  read_only_auditor: [
    "releases:read",
    "gates:read",
    "monitoring:read",
    "incidents:read",
    "backup:read",
    "github:read",
    "coolify:read",
    "overview:read",
    "audit:read",
  ],
  ai_agent: [
    "releases:read",
    "gates:read",
    "monitoring:read",
    "incidents:read",
    "backup:read",
    "github:read",
    "coolify:read",
    "overview:read",
    /* explicitly no approval/deployment/policy/roles/credentials */
  ],
};

export function permissionsForRole(role: ArcRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: ArcRole, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

/** Phase 2A hard rule: no role receives deployment:execute */
export function assertNoExecuteGrants(): void {
  for (const role of Object.keys(ROLE_PERMISSIONS) as ArcRole[]) {
    if (ROLE_PERMISSIONS[role].includes("deployment:execute")) {
      throw new Error(`Phase 2A violation: ${role} has deployment:execute`);
    }
  }
}

assertNoExecuteGrants();
