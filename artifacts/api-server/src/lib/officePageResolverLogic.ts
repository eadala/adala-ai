const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Trial tenant ids from onboarding — NOT office_page.id (uuid). */
export function isTrialTenantId(value: string): boolean {
  return value.startsWith("trial_");
}

export type OfficePageLookupInput = {
  tenantId: string;
  isActiveMember: boolean;
  registryOfficeId: string | null;
  uuidMembershipOfficeId: string | null;
  trialOfficeId: string | null;
  trialOfficeName?: string | null;
};

export type OfficePageLookupResult =
  | { status: "found"; officePageId: string }
  | { status: "trial_pending"; trialOfficeId: string; officeName?: string }
  | { status: "forbidden" }
  | { status: "not_found"; resolvedTenantId: string };

/**
 * Pure lookup strategy — maps tenant resolution ids to office_page.id (uuid).
 * trial_* ids are tenant scope keys in office_members/trial_offices, never office_page PKs.
 */
export function resolveOfficePageLookup(input: OfficePageLookupInput): OfficePageLookupResult {
  if (!input.isActiveMember) {
    return { status: "forbidden" };
  }

  /* Prefer a real marketplace office_page (uuid) over trial tenant scope */
  if (input.uuidMembershipOfficeId && isUuid(input.uuidMembershipOfficeId)) {
    return { status: "found", officePageId: input.uuidMembershipOfficeId };
  }

  if (input.registryOfficeId && isUuid(input.registryOfficeId)) {
    return { status: "found", officePageId: input.registryOfficeId };
  }

  if (isUuid(input.tenantId)) {
    return { status: "found", officePageId: input.tenantId };
  }

  if (isTrialTenantId(input.tenantId) || input.trialOfficeId) {
    return {
      status: "trial_pending",
      trialOfficeId: input.trialOfficeId ?? input.tenantId,
      officeName: input.trialOfficeName ?? undefined,
    };
  }

  return { status: "not_found", resolvedTenantId: input.tenantId };
}
