export type ResolveTenantIdFn = (userId: string, headerTenantId?: string) => Promise<string | null>;

async function defaultResolveTenantId(): Promise<ResolveTenantIdFn> {
  const { resolveTenantId } = await import("../middlewares/tenantMiddleware");
  return resolveTenantId;
}

/**
 * Resolve the acting user's canonical office via the injected
 * resolveTenantId (NEVER the Clerk user id) BEFORE running `insert`. The
 * insert callback is NEVER invoked when no tenant can be resolved — the
 * caller must deny the request instead.
 *
 * NOTE (confirmed, out of scope for this gate): the `messages` table has no
 * `office_id` column in any migration or the Drizzle schema
 * (lib/db/src/schema/messages.ts). This gate therefore cannot persist the
 * resolved office on the inserted row today — that requires a dedicated
 * schema migration. It still guarantees the insert is never reached for an
 * unresolvable tenant, and the resolved `officeId` is available to the
 * `insert` callback so it can be persisted as soon as the column exists.
 */
export async function insertForResolvedOffice<T>(
  params: { userId: string; headerTenant?: string },
  insert: (officeId: string) => Promise<T>,
  deps?: { resolveTenantId?: ResolveTenantIdFn },
): Promise<T | null> {
  const resolveTenantId = deps?.resolveTenantId ?? (await defaultResolveTenantId());
  const officeId = await resolveTenantId(params.userId, params.headerTenant);
  if (!officeId) return null; // fail closed — insert is never invoked
  return insert(officeId);
}
