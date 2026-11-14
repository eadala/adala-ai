/**
 * Connection-pool GUC containment (F-TENANT-POOL-001 / ADR-001).
 * Ensures every checked-out client starts fail-closed and every release
 * clears bypass_rls + tenant to __unscoped__ on the SAME client.
 */
import type pg from "pg";

export const TENANT_DENY_SENTINEL = "__unscoped__";

const RESET_SQL = `
  SELECT
    set_config('app.current_tenant', '${TENANT_DENY_SENTINEL}', false),
    set_config('app.tenant_id', '${TENANT_DENY_SENTINEL}', false),
    set_config('app.bypass_rls', 'off', false)
`;

export function installPoolGucGuard(pool: pg.Pool): void {
  const marked = pool as pg.Pool & { __gucGuardInstalled?: boolean };
  if (marked.__gucGuardInstalled) return;
  marked.__gucGuardInstalled = true;

  const originalConnect = pool.connect.bind(pool);

  pool.connect = ((cb?: Parameters<pg.Pool["connect"]>[0]) => {
    if (typeof cb === "function") {
      return originalConnect((err, client, done) => {
        if (err || !client) return cb(err, client as never, done);
        void resetClient(client)
          .then(() => {
            wrapRelease(client);
            cb(null, client, done);
          })
          .catch((e) => cb(e as Error, undefined as never, done));
      });
    }
    return originalConnect().then(async (client) => {
      await resetClient(client);
      wrapRelease(client);
      return client;
    });
  }) as typeof pool.connect;

  pool.on("connect", (client) => {
    void resetClient(client);
  });
}

async function resetClient(client: pg.PoolClient): Promise<void> {
  await client.query(RESET_SQL);
}

function wrapRelease(client: pg.PoolClient): void {
  const c = client as pg.PoolClient & { __gucReleaseWrapped?: boolean };
  if (c.__gucReleaseWrapped) return;
  c.__gucReleaseWrapped = true;
  const originalRelease = client.release.bind(client);
  client.release = (err?: Error | boolean) => {
    void resetClient(client)
      .catch(() => {})
      .finally(() => originalRelease(err as Error | undefined));
  };
}
