/**
 * Gift subscription ownership helpers (Stage 16.3 / Migration 026).
 * Tenant reads/writes require a canonical Office UUID + authenticated user_id.
 * Legacy NULL-owned rows stay invisible — never backfill from the requester.
 */
import {
  assertCanonicalBusinessOfficeId,
  TenantResolutionError,
} from "./tenantResolution";

export type GiftOwner = {
  officeId: string;
  userId: string;
};

export type GiftOwnerRequest = {
  userId?: string;
  tenantId?: string;
};

/**
 * Resolve office_id + user_id for gift redeem / my-gift / entitlement reads.
 * Rejects platform / default / trial_* / NULL — never guess ownership.
 */
export function resolveGiftOwner(
  req: GiftOwnerRequest,
  source: string,
): GiftOwner {
  const userId = typeof req.userId === "string" ? req.userId.trim() : "";
  if (!userId) {
    const err = new Error("GIFT_OWNER_UNAUTHENTICATED") as Error & {
      status: number;
      code: string;
    };
    err.status = 401;
    err.code = "GIFT_OWNER_UNAUTHENTICATED";
    throw err;
  }
  const officeId = assertCanonicalBusinessOfficeId(req.tenantId, {
    userId,
    source,
  });
  return { officeId, userId };
}

export function giftOwnerHttpStatus(err: unknown): number {
  if (err instanceof TenantResolutionError) {
    if (err.code === "LEGACY_NON_UUID_TENANT") return 409;
    return 403;
  }
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return 403;
}

export { TenantResolutionError };
