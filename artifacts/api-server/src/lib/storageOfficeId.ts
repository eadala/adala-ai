/**
 * Resolve office_id for storage management routes.
 * Prefer tenant context from requireAuthWithTenant; never invent from Clerk userId.
 */
export function resolveStorageOfficeId(input: {
  tenantId?: unknown;
  metadataOfficeId?: unknown;
}): string | null {
  const fromTenant = normalizeOfficeId(input.tenantId);
  if (fromTenant) return fromTenant;

  const fromMetadata = normalizeOfficeId(input.metadataOfficeId);
  if (fromMetadata) return fromMetadata;

  return null;
}

function normalizeOfficeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
