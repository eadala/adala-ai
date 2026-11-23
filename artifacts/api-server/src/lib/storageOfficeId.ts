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

/** Stable client-facing response when auth exists but office/tenant cannot be resolved. */
export const OFFICE_CONTEXT_REQUIRED = {
  code: "OFFICE_CONTEXT_REQUIRED",
  message:
    "تعذر تحديد المكتب المرتبط بحسابك. يرجى إكمال إعداد المكتب أو التواصل مع المسؤول.",
} as const;

export type StorageMgmtAuthFailure = "unauthenticated" | "office_required";

export function storageMgmtAuthResponse(failure: StorageMgmtAuthFailure): {
  status: 401 | 403;
  body: Record<string, string>;
} {
  if (failure === "office_required") {
    return { status: 403, body: { ...OFFICE_CONTEXT_REQUIRED } };
  }
  return { status: 401, body: { error: "غير مصادق" } };
}

function normalizeOfficeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
