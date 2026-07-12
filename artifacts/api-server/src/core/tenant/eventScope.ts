/**
 * Event tenant scope — fail-closed office resolution for event handlers.
 */
import type { StoredEvent } from "../eventBus";
import { isRealOfficeTenantId } from "../tenantContext";

/**
 * Resolve a verified office_id from an event payload.
 * Returns null when tenant context is missing or uses a banned identifier.
 */
export function requireEventOfficeId(event: StoredEvent): string | null {
  const candidate = event.officeId ?? (event.data?.officeId as string | undefined);
  if (!isRealOfficeTenantId(candidate)) return null;
  return candidate;
}
