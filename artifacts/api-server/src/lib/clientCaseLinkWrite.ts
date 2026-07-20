import { sql } from "drizzle-orm";

export type ResolveTenantIdFn = (userId: string, headerTenantId?: string) => Promise<string | null>;

type DbLike = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

async function defaultDb(): Promise<DbLike> {
  const { db } = await import("@workspace/db");
  return db as unknown as DbLike;
}

async function defaultResolveTenantId(): Promise<ResolveTenantIdFn> {
  const { resolveTenantId } = await import("../middlewares/tenantMiddleware");
  return resolveTenantId;
}

export type LinkClientCaseInput = {
  userId: string;
  headerTenant?: string;
  clientId: string;
  caseId: string;
  portalTokenId: string | null;
  portalToken: string | null;
};

/**
 * Resolve the acting admin's canonical office via the injected
 * resolveTenantId (NEVER the Clerk user id), then insert a
 * client_case_links row scoped to THAT office. Returns null — and performs
 * NO insert — when no tenant can be resolved, so client_case_links.office_id
 * can never receive a Clerk user id.
 */
export async function linkClientCase(
  input: LinkClientCaseInput,
  deps?: { resolveTenantId?: ResolveTenantIdFn; db?: DbLike },
): Promise<{ officeId: string } | null> {
  const resolveTenantId = deps?.resolveTenantId ?? (await defaultResolveTenantId());
  const officeId = await resolveTenantId(input.userId, input.headerTenant);
  if (!officeId) return null; // fail closed — never substitute the Clerk user id

  const client = deps?.db ?? (await defaultDb());
  await client.execute(sql`
    INSERT INTO client_case_links (client_id, case_id, portal_token_id, portal_token, office_id)
    VALUES (${input.clientId}, ${input.caseId}, ${input.portalTokenId}, ${input.portalToken}, ${officeId})
    ON CONFLICT (client_id, case_id) DO NOTHING
  `);
  return { officeId };
}
