/**
 * Office-tasks tenant rules.
 *
 * LIST (GET) — temporary legacy readability:
 *   UUID tenant: office_id = tenant OR office_id IS NULL
 *   Non-UUID: unrestricted list (historical GET WHERE TRUE)
 *
 * MUTATE (PATCH/DELETE) — strict ownership only:
 *   office_id = resolvedTenantOfficeId
 *   Non-UUID tenant → reject (403); no WHERE TRUE
 *   NULL office_id rows are legacy orphans: readable, not mutable by ordinary tenants.
 *   Do not reassign NULL → current tenant on mutate. Cleanup is a separate migration stage.
 *   No platform-wide mutate via non-UUID string in this stage.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toUuid(v: unknown): string | null {
  if (!v || !UUID_RE.test(String(v))) return null;
  return String(v);
}

/** Resolve office UUID required for PATCH/DELETE. Null → reject mutation. */
export function resolveMutationOfficeId(tenantId: unknown): string | null {
  return toUuid(tenantId);
}

/**
 * Strict mutate ownership. NULL office_id is never mutable by ordinary tenants.
 * Non-UUID tenant never mutates.
 */
export function canMutateTaskOffice(
  taskOfficeId: string | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  const officeId = resolveMutationOfficeId(tenantId);
  if (!officeId) return false;
  if (taskOfficeId == null || taskOfficeId === "") return false;
  return String(taskOfficeId).toLowerCase() === officeId.toLowerCase();
}

/**
 * GET list visibility (legacy). Prefer canMutateTaskOffice for write checks.
 * @deprecated for mutation — list-only until NULL-office cleanup migration.
 */
export function isTaskListedForTenant(
  taskOfficeId: string | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  const officeId = toUuid(tenantId);
  if (!officeId) return true;
  if (taskOfficeId == null || taskOfficeId === "") return true;
  return String(taskOfficeId).toLowerCase() === officeId.toLowerCase();
}
