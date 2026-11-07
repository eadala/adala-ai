/**
 * P0 GUC containment — request/operation-scoped PoolClient binding.
 *
 * Session GUCs are sticky on a PostgreSQL backend. Short-lived pool checkouts
 * made set_config leak across requests. This module:
 *  1. Pins one PoolClient for a trusted ALS scope (office / bypass).
 *  2. Routes pool.query to that client while bound.
 *  3. On unbound pool.query, checkouts start and end fail-closed.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

export const TENANT_DENY_SENTINEL = "__unscoped__";

type DbScopeStore = {
  client: PoolClient;
  bound: true;
};

const dbScopeAls = new AsyncLocalStorage<DbScopeStore>();

export function getBoundPoolClient(): PoolClient | undefined {
  return dbScopeAls.getStore()?.client;
}

export function isDbScopeActive(): boolean {
  return dbScopeAls.getStore()?.bound === true;
}

const FAIL_CLOSED_SQL = `
  SELECT
    set_config('app.current_tenant', $1, false),
    set_config('app.tenant_id', $1, false),
    set_config('app.bypass_rls', 'off', false)
`;

export async function applyFailClosedGucs(client: PoolClient): Promise<void> {
  await client.query(FAIL_CLOSED_SQL, [TENANT_DENY_SENTINEL]);
}

export async function applyOfficeGucs(client: PoolClient, officeId: string): Promise<void> {
  if (!officeId || officeId === TENANT_DENY_SENTINEL || officeId === "") {
    await applyFailClosedGucs(client);
    return;
  }
  await client.query(
    `
    SELECT
      set_config('app.current_tenant', $1, false),
      set_config('app.tenant_id', $1, false),
      set_config('app.bypass_rls', 'off', false)
    `,
    [officeId],
  );
}

export async function applyBypassGucs(client: PoolClient): Promise<void> {
  await client.query(
    `
    SELECT
      set_config('app.bypass_rls', 'on', false),
      set_config('app.current_tenant', $1, false),
      set_config('app.tenant_id', $1, false)
    `,
    [TENANT_DENY_SENTINEL],
  );
}

type ReleaseFn = (err?: Error | boolean) => void;

/** Capture the pool's release for THIS checkout (pg reassigns release each acquire). */
function captureCheckoutRelease(client: PoolClient): ReleaseFn {
  if (typeof client.release !== "function") {
    throw new Error("PoolClient.release missing");
  }
  return client.release.bind(client) as ReleaseFn;
}

async function releaseFailClosed(client: PoolClient, trueRelease: ReleaseFn, err?: Error | boolean): Promise<void> {
  try {
    await applyFailClosedGucs(client);
  } catch {
    /* still release */
  }
  trueRelease(err);
}

/**
 * Run fn with a pinned pool client. All drizzle pool.query traffic inside fn
 * uses this client. GUCs are fail-closed before release (Invariant D).
 */
export async function withPinnedDbScope<T>(
  pool: Pool,
  init: (client: PoolClient) => Promise<void>,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = dbScopeAls.getStore();
  if (existing?.bound) {
    await init(existing.client);
    return fn();
  }

  const client = await pool.connect();
  const trueRelease = captureCheckoutRelease(client);
  client.release = (() => {
    /* pinned — ignore nested drizzle releases */
  }) as PoolClient["release"];

  try {
    await applyFailClosedGucs(client);
    await init(client);
    return await dbScopeAls.run({ client, bound: true }, fn);
  } finally {
    client.release = trueRelease as PoolClient["release"];
    await releaseFailClosed(client, trueRelease);
  }
}

export async function withOfficeDbScope<T>(
  pool: Pool,
  officeId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withPinnedDbScope(pool, (c) => applyOfficeGucs(c, officeId), fn);
}

export async function withBypassDbScope<T>(pool: Pool, fn: () => Promise<T>): Promise<T> {
  return withPinnedDbScope(pool, (c) => applyBypassGucs(c), fn);
}

export async function withFailClosedDbScope<T>(pool: Pool, fn: () => Promise<T>): Promise<T> {
  return withPinnedDbScope(pool, (c) => applyFailClosedGucs(c), fn);
}

/**
 * Install query routing for bound scopes + fail-closed unbound checkouts.
 * Safe to call once at pool construction.
 */
export function installPoolGucContainment(pool: Pool): Pool {
  const marked = pool as Pool & { __gucContainmentInstalled?: boolean };
  if (marked.__gucContainmentInstalled) return pool;
  marked.__gucContainmentInstalled = true;

  const realQuery = pool.query.bind(pool);
  const realConnect = pool.connect.bind(pool);

  (pool as Pool).query = ((text: unknown, values?: unknown, cb?: unknown) => {
    const bound = getBoundPoolClient();
    if (bound) {
      return (bound.query as (...a: unknown[]) => unknown)(text, values, cb);
    }

    if (typeof values === "function" || typeof cb === "function") {
      return (realQuery as (...a: unknown[]) => unknown)(text, values, cb);
    }

    return (async () => {
      const client = await realConnect();
      const trueRelease = captureCheckoutRelease(client);
      try {
        await applyFailClosedGucs(client);
        return await client.query(text as string, values as unknown[] | undefined);
      } finally {
        await releaseFailClosed(client, trueRelease);
      }
    })();
  }) as Pool["query"];

  (pool as Pool).connect = ((arg?: unknown) => {
    const bound = getBoundPoolClient();
    if (bound) {
      const noopRelease: ReleaseFn = () => {
        /* scope-owned */
      };
      if (typeof arg === "function") {
        (arg as (err: Error | null, client: PoolClient, done: ReleaseFn) => void)(
          null,
          bound,
          noopRelease,
        );
        return;
      }
      return Promise.resolve(bound);
    }

    if (typeof arg === "function") {
      return realConnect(arg as Parameters<Pool["connect"]>[0]);
    }

    return Promise.resolve(realConnect());
  }) as Pool["connect"];

  return pool;
}
