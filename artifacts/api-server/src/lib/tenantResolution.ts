/**
 * Pure tenant-id classification + structured resolution errors.
 * Used by tenantMiddleware / TIRE so Stage 15.2b rules stay testable.
 */
import { isTrialTenantId, isUuid } from "./officePageResolverLogic";

export const LEGACY_NON_UUID_TENANT = "LEGACY_NON_UUID_TENANT";
export const PLATFORM_FORBIDDEN_FOR_USER = "PLATFORM_FORBIDDEN_FOR_USER";
export const TENANT_PROVISION_FAILED = "TENANT_PROVISION_FAILED";

export type TenantIdKind = "uuid" | "legacy_trial" | "default" | "platform" | "empty" | "other";

export class TenantResolutionError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "TenantResolutionError";
    this.code = code;
    this.details = details;
  }
}

export function classifyTenantId(value: string | null | undefined): TenantIdKind {
  if (value == null) return "empty";
  const id = String(value).trim();
  if (!id) return "empty";
  if (id === "default") return "default";
  if (id === "platform") return "platform";
  if (isTrialTenantId(id)) return "legacy_trial";
  if (isUuid(id)) return "uuid";
  return "other";
}

/** True only for cacheable normal-user office ids (UUID). */
export function isCacheableTenantId(value: string): boolean {
  return classifyTenantId(value) === "uuid";
}

/**
 * Accept a resolved office id for a normal user.
 * - UUID → return
 * - default / empty → treat as missing (null)
 * - trial_* → fail closed with migration payload (no second office)
 * - platform → never for normal users
 * - other text → return but caller must not cache
 */
export function acceptNormalUserTenantId(
  officeId: string | null | undefined,
  meta: { userId: string; source: string },
): string | null {
  const kind = classifyTenantId(officeId);
  switch (kind) {
    case "uuid":
      return String(officeId);
    case "empty":
    case "default":
      return null;
    case "platform":
      throw new TenantResolutionError(
        PLATFORM_FORBIDDEN_FOR_USER,
        "Normal users must never resolve to the synthetic platform tenant",
        { userId: meta.userId, source: meta.source, officeId: "platform" },
      );
    case "legacy_trial":
      throw new TenantResolutionError(
        LEGACY_NON_UUID_TENANT,
        `Legacy non-UUID tenant ${String(officeId)} requires migration (Stage 15.2c)`,
        {
          userId: meta.userId,
          source: meta.source,
          legacyOfficeId: String(officeId),
          needsMigration: true,
          migrationStage: "15.2c",
          action: "remap_trial_to_uuid_office_page",
        },
      );
    case "other":
      return String(officeId);
    default:
      return null;
  }
}
