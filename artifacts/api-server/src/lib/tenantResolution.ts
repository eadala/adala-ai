/**
 * Pure tenant-id classification + structured resolution errors.
 * Stage 15.2b final: normal users resolve only to canonical Office UUIDs.
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

function legacyMigrationError(
  officeId: string,
  meta: { userId: string; source: string },
  extra: Record<string, unknown> = {},
): TenantResolutionError {
  return new TenantResolutionError(
    LEGACY_NON_UUID_TENANT,
    `Non-UUID tenant ${officeId} requires migration (Stage 15.2c)`,
    {
      userId: meta.userId,
      source: meta.source,
      legacyOfficeId: officeId,
      needsMigration: true,
      migrationStage: "15.2c",
      action: "remap_to_uuid_office_page",
      ...extra,
    },
  );
}

/**
 * Accept a resolved office id for a normal user.
 * - UUID → return
 * - empty → null (no value; continue resolution / HEAL)
 * - default / trial_* / platform / arbitrary text → fail closed (never returned)
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
      return null;
    case "platform":
      throw new TenantResolutionError(
        PLATFORM_FORBIDDEN_FOR_USER,
        "Normal users must never resolve to the synthetic platform tenant",
        { userId: meta.userId, source: meta.source, officeId: "platform" },
      );
    case "default":
    case "legacy_trial":
    case "other":
      throw legacyMigrationError(String(officeId), meta);
    default:
      return null;
  }
}

/**
 * Lookup helper for resolution steps: UUID wins; empty continues to later
 * steps / HEAL; any non-UUID value (default, trial_*, platform, text) fails closed.
 */
export function takeCanonicalTenantOrContinue(
  officeId: string | null | undefined,
  meta: { userId: string; source: string },
): { status: "uuid"; officeId: string } | { status: "continue" } {
  const kind = classifyTenantId(officeId);
  if (kind === "uuid") return { status: "uuid", officeId: String(officeId) };
  if (kind === "empty") return { status: "continue" };
  /* default / trial_* / platform / arbitrary text — fail closed, never returned */
  acceptNormalUserTenantId(officeId, meta);
  return { status: "continue" };
}

/**
 * Gate for ordinary business-data writes (and SA office targeting).
 * Only a canonical Office UUID is allowed as office_id.
 * "platform" / "default" / trial_* / arbitrary text are never business office ids.
 */
export function assertCanonicalBusinessOfficeId(
  officeId: string | null | undefined,
  meta: { userId: string; source: string },
): string {
  const kind = classifyTenantId(officeId);
  if (kind === "uuid") return String(officeId);
  if (kind === "platform") {
    throw new TenantResolutionError(
      PLATFORM_FORBIDDEN_FOR_USER,
      "Synthetic platform context cannot own or write business office data",
      { userId: meta.userId, source: meta.source, officeId: "platform" },
    );
  }
  if (kind === "empty") {
    throw new TenantResolutionError(
      LEGACY_NON_UUID_TENANT,
      "Business writes require a canonical Office UUID",
      {
        userId: meta.userId,
        source: meta.source,
        legacyOfficeId: null,
        needsMigration: true,
        migrationStage: "15.2c",
        action: "remap_to_uuid_office_page",
      },
    );
  }
  throw legacyMigrationError(String(officeId), meta, { blocksBusinessWrites: true });
}
