/**
 * Shared tenant visibility for office tasks (GET / PATCH / DELETE).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toUuid(v: unknown): string | null {
  if (!v || !UUID_RE.test(String(v))) return null;
  return String(v);
}

/**
 * UUID tenant: own `office_id` OR legacy NULL `office_id`.
 * Non-UUID tenant (e.g. platform): unrestricted (matches GET `WHERE TRUE`).
 */
export function isTaskVisibleToTenant(
  taskOfficeId: string | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  const officeId = toUuid(tenantId);
  if (!officeId) return true;
  if (taskOfficeId == null || taskOfficeId === "") return true;
  return String(taskOfficeId).toLowerCase() === officeId.toLowerCase();
}
