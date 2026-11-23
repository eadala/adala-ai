import { db } from "@workspace/db";
import { officePageTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  isTrialTenantId,
  resolveOfficePageLookup,
} from "./officePageResolverLogic";

export {
  isUuid,
  isTrialTenantId,
  resolveOfficePageLookup,
  type OfficePageLookupInput,
  type OfficePageLookupResult,
} from "./officePageResolverLogic";

export type OfficePageForUserResult =
  | { kind: "found"; office: typeof officePageTable.$inferSelect; tenantId: string }
  | { kind: "trial_pending"; trialOfficeId: string; officeName?: string; tenantId: string }
  | { kind: "forbidden" }
  | { kind: "not_found"; tenantId: string };

async function dbOne<T extends Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<T | null> {
  const r = await db.execute(q) as { rows?: T[] } | T[];
  const rows = Array.isArray(r) ? r : (r?.rows ?? []);
  return (rows[0] as T | undefined) ?? null;
}

export async function fetchOfficePageForUser(
  userId: string,
  tenantId: string,
): Promise<OfficePageForUserResult> {
  const memberRow = await dbOne<{ ok: number }>(sql`
    SELECT 1 AS ok FROM office_members
    WHERE user_id = ${userId} AND office_id = ${tenantId} AND status = 'active'
    LIMIT 1
  `);

  const uuidMember = await dbOne<{ office_id: string }>(sql`
    SELECT office_id FROM office_members
    WHERE user_id = ${userId} AND status = 'active'
      AND office_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const registry = await dbOne<{ id: string }>(sql`
    SELECT id FROM office_registry
    WHERE clerk_user_id = ${userId} AND status = 'active'
    LIMIT 1
  `);

  const trial = await dbOne<{ office_id: string; office_name: string }>(sql`
    SELECT office_id, office_name FROM trial_offices
    WHERE user_id = ${userId}
    LIMIT 1
  `);

  const lookup = resolveOfficePageLookup({
    tenantId,
    isActiveMember: !!memberRow,
    registryOfficeId: registry?.id ?? null,
    uuidMembershipOfficeId: uuidMember?.office_id ?? null,
    trialOfficeId: trial?.office_id ?? null,
    trialOfficeName: trial?.office_name ?? null,
  });

  if (lookup.status === "forbidden") {
    return { kind: "forbidden" };
  }

  if (lookup.status === "trial_pending") {
    return {
      kind: "trial_pending",
      trialOfficeId: lookup.trialOfficeId,
      officeName: lookup.officeName,
      tenantId,
    };
  }

  if (lookup.status === "not_found") {
    return { kind: "not_found", tenantId: lookup.resolvedTenantId };
  }

  const pageMember = await dbOne<{ ok: number }>(sql`
    SELECT 1 AS ok FROM office_members
    WHERE user_id = ${userId} AND office_id = ${lookup.officePageId} AND status = 'active'
    LIMIT 1
  `);
  const ownsViaRegistry = registry?.id === lookup.officePageId;

  if (!pageMember && !ownsViaRegistry) {
    return { kind: "forbidden" };
  }

  const offices = await db.select().from(officePageTable)
    .where(eq(officePageTable.id, lookup.officePageId))
    .limit(1);

  if (!offices[0]) {
    if (isTrialTenantId(tenantId)) {
      return {
        kind: "trial_pending",
        trialOfficeId: tenantId,
        officeName: trial?.office_name,
        tenantId,
      };
    }
    return { kind: "not_found", tenantId: lookup.officePageId };
  }

  return { kind: "found", office: offices[0], tenantId: lookup.officePageId };
}
