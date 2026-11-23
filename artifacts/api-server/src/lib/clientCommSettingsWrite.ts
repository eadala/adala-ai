import { sql } from "drizzle-orm";

export type ResolveTenantIdFn = (userId: string, headerTenantId?: string) => Promise<string | null>;

type DbLike = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const withRows = result as { rows?: Record<string, unknown>[] } | null;
  return withRows?.rows ?? [];
}

async function defaultDb(): Promise<DbLike> {
  const { db } = await import("@workspace/db");
  return db as unknown as DbLike;
}

async function defaultResolveTenantId(): Promise<ResolveTenantIdFn> {
  const { resolveTenantId } = await import("../middlewares/tenantMiddleware");
  return resolveTenantId;
}

export type CommSettingsRoles = {
  /** Postgres text[] literal, e.g. "{firm_owner,lawyer}" — caller must whitelist values */
  replyRoles: string;
  portalRoles: string;
  timelineRoles: string;
  intakeRoles: string;
  requireReplyApproval: boolean;
};

export type WriteClientCommSettingsInput = {
  userId: string;
  headerTenant?: string;
  roles: CommSettingsRoles;
};

/**
 * Resolve the acting user's canonical office via the injected
 * resolveTenantId (NEVER the Clerk user id), then upsert
 * client_comm_settings scoped to THAT office. Returns null — and performs
 * NO write — when no tenant can be resolved, so the caller can deny the
 * request using its existing error response.
 */
export async function writeClientCommSettings(
  input: WriteClientCommSettingsInput,
  deps?: { resolveTenantId?: ResolveTenantIdFn; db?: DbLike },
): Promise<{ officeId: string } | null> {
  const resolveTenantId = deps?.resolveTenantId ?? (await defaultResolveTenantId());
  const officeId = await resolveTenantId(input.userId, input.headerTenant);
  if (!officeId) return null; // fail closed — never substitute the Clerk user id

  const client = deps?.db ?? (await defaultDb());
  const { replyRoles, portalRoles, timelineRoles, intakeRoles, requireReplyApproval } = input.roles;

  const existing = rowsOf(await client.execute(sql`SELECT id FROM client_comm_settings WHERE office_id=${officeId}`));
  if (existing.length > 0) {
    await client.execute(sql`
      UPDATE client_comm_settings SET
        reply_roles=${replyRoles}::text[], portal_roles=${portalRoles}::text[],
        timeline_roles=${timelineRoles}::text[], intake_roles=${intakeRoles}::text[],
        require_reply_approval=${requireReplyApproval}, updated_at=NOW()
      WHERE office_id=${officeId}`);
  } else {
    await client.execute(sql`
      INSERT INTO client_comm_settings (office_id,reply_roles,portal_roles,timeline_roles,intake_roles,require_reply_approval)
      VALUES (${officeId},${replyRoles}::text[],${portalRoles}::text[],${timelineRoles}::text[],${intakeRoles}::text[],${requireReplyApproval})`);
  }
  return { officeId };
}
