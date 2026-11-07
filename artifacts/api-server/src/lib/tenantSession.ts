/**
 * Trusted PostgreSQL session GUCs for tenant isolation (ADR-001 / P0 containment).
 *
 * GUCs must be applied on a pinned pool client that also executes the protected
 * queries. Use withOfficeDbScope / withBypassDbScope (or *UntilResponse helpers)
 * so drizzle traffic shares that client. Never rely on empty tenant as privilege.
 */
import type { Response } from "express";
import {
  pool,
  TENANT_DENY_SENTINEL as DB_DENY,
  applyFailClosedGucs,
  applyOfficeGucs,
  applyBypassGucs,
  getBoundPoolClient,
  withOfficeDbScope,
  withBypassDbScope,
  withFailClosedDbScope,
} from "@workspace/db";

/** Non-matching sentinel — denies under both legacy and fail-closed policies. */
export const TENANT_DENY_SENTINEL = DB_DENY;

function requireBoundClient(op: string) {
  const client = getBoundPoolClient();
  if (!client) {
    throw new Error(
      `${op} requires an active pinned DB scope (withOfficeDbScope / withBypassDbScope)`,
    );
  }
  return client;
}

function waitForResponseEnd(res: Response): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    res.on("finish", done);
    res.on("close", done);
  });
}

/** Fail-closed GUCs on the bound client, or a short fail-closed scope if unbound. */
export async function setFailClosedTenantSession(): Promise<void> {
  const bound = getBoundPoolClient();
  if (bound) {
    await applyFailClosedGucs(bound);
    return;
  }
  await withFailClosedDbScope(pool, async () => {
    /* scope init already fail-closed */
  });
}

export async function setOfficeTenantSession(officeId: string): Promise<void> {
  const client = requireBoundClient("setOfficeTenantSession");
  await applyOfficeGucs(client, officeId);
}

/** Explicit privileged path — Super Admin / signed webhooks / approved system jobs. */
export async function setBypassRlsSession(): Promise<void> {
  const client = requireBoundClient("setBypassRlsSession");
  await applyBypassGucs(client);
}

export async function clearTenantSessionFailClosed(): Promise<void> {
  await setFailClosedTenantSession();
}

export async function runWithOfficeDbScope<T>(officeId: string, fn: () => Promise<T>): Promise<T> {
  return withOfficeDbScope(pool, officeId, fn);
}

export async function runWithBypassDbScope<T>(fn: () => Promise<T>): Promise<T> {
  return withBypassDbScope(pool, fn);
}

export async function runWithFailClosedDbScope<T>(fn: () => Promise<T>): Promise<T> {
  return withFailClosedDbScope(pool, fn);
}

/** Pin office GUCs for the lifetime of an HTTP response (Invariant E). */
export async function runWithOfficeDbScopeUntilResponse(
  officeId: string,
  res: Response,
  begin: () => void,
): Promise<void> {
  await withOfficeDbScope(pool, officeId, async () => {
    const ended = waitForResponseEnd(res);
    begin();
    await ended;
  });
}

/** Pin bypass GUCs for the lifetime of an HTTP response. */
export async function runWithBypassDbScopeUntilResponse(
  res: Response,
  begin: () => void,
): Promise<void> {
  await withBypassDbScope(pool, async () => {
    const ended = waitForResponseEnd(res);
    begin();
    await ended;
  });
}
