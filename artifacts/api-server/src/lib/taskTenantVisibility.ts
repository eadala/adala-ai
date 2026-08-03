/**
 * Office-tasks tenant ownership (strict).
 *
 * All operations (GET / INSERT / PATCH / DELETE) require a resolved office UUID:
 *   office_id = :resolvedTenantOfficeId
 *
 * Never treat office_id IS NULL as belonging to the caller.
 * Never use WHERE TRUE for tenant scoping.
 * Non-UUID tenant resolution → reject (403) — no platform mutate/list bypass.
 *
 * Legacy NULL office_id rows are orphans (POST /office-tasks toUuid fallback,
 * case autopilot omitting office_id). They are backfilled via trusted
 * case_id→cases / branch_id→office_branches joins in migration 022, or moved
 * to tasks_orphan_quarantine when ownership is ambiguous. Cleanup is not
 * inferred from the currently logged-in tenant.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toUuid(v: unknown): string | null {
  if (!v || !UUID_RE.test(String(v))) return null;
  return String(v);
}

/** Resolve office UUID required for any task read/write. Null → 403. */
export function resolveMutationOfficeId(tenantId: unknown): string | null {
  return toUuid(tenantId);
}

/** Alias — same resolution for list and mutate. */
export function resolveTaskOfficeId(tenantId: unknown): string | null {
  return resolveMutationOfficeId(tenantId);
}

/**
 * Strict ownership: task.office_id must equal the resolved tenant office UUID.
 * NULL / empty / other office → false.
 */
export function canAccessTaskOffice(
  taskOfficeId: string | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  const officeId = resolveTaskOfficeId(tenantId);
  if (!officeId) return false;
  if (taskOfficeId == null || taskOfficeId === "") return false;
  return String(taskOfficeId).toLowerCase() === officeId.toLowerCase();
}

/** @deprecated Use canAccessTaskOffice — mutate and list share the same rule. */
export function canMutateTaskOffice(
  taskOfficeId: string | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  return canAccessTaskOffice(taskOfficeId, tenantId);
}

/**
 * @deprecated List no longer includes NULL-office orphans.
 * Kept only so older tests importing the name fail closed (always false for NULL).
 */
export function isTaskListedForTenant(
  taskOfficeId: string | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  return canAccessTaskOffice(taskOfficeId, tenantId);
}
