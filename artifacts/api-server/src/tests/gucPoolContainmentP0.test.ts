/**
 * P0 — privileged GUC must not leak across pooled connections.
 * Run: pnpm --filter @workspace/api-server run test:guc-pool-containment-p0
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const requireFromDb = createRequire(join(ROOT, "lib/db/package.json"));
 
const { Pool } = requireFromDb("pg") as {
  Pool: new (c: object) => {
    connect: () => Promise<PoolClient>;
    query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
    end: () => Promise<void>;
    on: (ev: string, fn: (c: PoolClient) => void) => void;
  };
};

type PoolClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  release: (err?: Error | boolean) => void;
};

process.env.DATABASE_URL ??=
  "postgresql://adala_app:repro_app@127.0.0.1:5432/adala_rls_repro";

const {
  installPoolGucContainment,
  withBypassDbScope,
  withOfficeDbScope,
  TENANT_DENY_SENTINEL,
} = await import("@workspace/db");

const DB = {
  host: process.env.P0_PGHOST ?? "127.0.0.1",
  database: process.env.P0_PGDATABASE ?? "adala_rls_repro",
  user: process.env.P0_PGUSER ?? "adala_app",
  password: process.env.P0_PGPASSWORD ?? "repro_app",
  max: 4,
};

type AnyPool = InstanceType<typeof Pool>;

async function count(pool: AnyPool): Promise<number> {
  const r = await pool.query("SELECT count(*)::int AS n FROM client_invoices_repro");
  return r.rows[0].n as number;
}

async function pidOf(client: PoolClient): Promise<number> {
  return (await client.query("SELECT pg_backend_pid() AS p")).rows[0].p as number;
}

console.log("\n═══ Static wiring ═══");
{
  const idx = readFileSync(join(ROOT, "lib/db/src/index.ts"), "utf8");
  assert.match(idx, /installPoolGucContainment/);
  const guc = readFileSync(join(ROOT, "lib/db/src/gucContainment.ts"), "utf8");
  assert.match(guc, /withBypassDbScope/);
  assert.match(guc, /getBoundPoolClient/);
  assert.match(guc, /applyFailClosedGucs/);
  const sess = readFileSync(join(ROOT, "artifacts/api-server/src/lib/tenantSession.ts"), "utf8");
  assert.match(sess, /runWithBypassDbScope/);
  assert.match(sess, /runWithOfficeDbScopeUntilResponse/);
  assert.match(sess, /requires an active pinned DB scope/);
  const stripe = readFileSync(join(ROOT, "artifacts/api-server/src/services/stripeEventBuffer.ts"), "utf8");
  const constructIdx = stripe.indexOf("constructEvent");
  const scopeIdx = stripe.indexOf("runWithBypassDbScope");
  assert.ok(constructIdx >= 0 && scopeIdx > constructIdx, "bypass scope after constructEvent");
  assert.ok(existsSync(join(ROOT, "lib/db/src/gucContainment.ts")));
  console.log("  ✅ containment wired in db + tenantSession + stripe");
}

let runtimeOk = true;
try {
  const probe = new Pool(DB);
  await probe.query("SELECT 1 FROM client_invoices_repro LIMIT 1");
  await probe.end();
} catch (e) {
  runtimeOk = false;
  console.log("\n═══ Runtime pool tests ═══");
  console.log("  ⏭️  skipped (adala_rls_repro unavailable):", (e as Error).message);
}

if (runtimeOk) {
  console.log("\n═══ Baseline: unsafe sticky bypass (no containment) ═══");
  {
    const raw = new Pool(DB);
    const c = await raw.connect();
    const pid = await pidOf(c);
    await c.query(
      `SELECT set_config('app.bypass_rls','on',false), set_config('app.current_tenant',$1,false)`,
      [TENANT_DENY_SENTINEL],
    );
    c.release();
    let leaked: number | null = null;
    for (let i = 0; i < 40; i++) {
      const x = await raw.connect();
      try {
        const p = await pidOf(x);
        if (p === pid) {
          leaked = (await x.query("SELECT count(*)::int AS n FROM client_invoices_repro")).rows[0]
            .n as number;
          break;
        }
      } finally {
        x.release();
      }
    }
    assert.equal(leaked, 2, "baseline must demonstrate bypass leak on reuse");
    console.log("  ✅ baseline leak reproduced (count=2 on reused backend)");
    await raw.end();
  }

  console.log("\n═══ Contained: release hygiene + bypass scope ═══");
  {
    // Cast: test Pool stub is structurally sufficient for containment helpers.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = installPoolGucContainment(new Pool(DB) as any);

    await withBypassDbScope(pool, async () => {
      assert.equal(await count(pool), 2, "inside bypass scope sees all");
    });
    assert.equal(await count(pool), 0, "after bypass scope, unbound query must not inherit bypass");
    console.log("  ✅ T1 privileged-to-normal reuse: no leak");

    await withOfficeDbScope(pool, "office-a", async () => {
      assert.equal(await count(pool), 1);
      const ids = (await pool.query("SELECT id FROM client_invoices_repro")).rows.map((r) => r.id);
      assert.deepEqual(ids, ["a"]);
    });
    await withOfficeDbScope(pool, "office-b", async () => {
      assert.equal(await count(pool), 1);
      const ids = (await pool.query("SELECT id FROM client_invoices_repro")).rows.map((r) => r.id);
      assert.deepEqual(ids, ["b"]);
    });
    await withOfficeDbScope(pool, "office-a", async () => {
      assert.equal(await count(pool), 1);
    });
    console.log("  ✅ T2 tenant switching isolation");

    try {
      await withBypassDbScope(pool, async () => {
        assert.equal(await count(pool), 2);
        throw new Error("simulated privileged failure");
      });
    } catch {
      /* expected */
    }
    assert.equal(await count(pool), 0, "exception path must not leak bypass");
    console.log("  ✅ T3 exception safety");

    const [nA, nB] = await Promise.all([
      withOfficeDbScope(pool, "office-a", async () => count(pool)),
      withOfficeDbScope(pool, "office-b", async () => count(pool)),
    ]);
    assert.equal(nA, 1);
    assert.equal(nB, 1);
    console.log("  ✅ T6 concurrency A/B");

    await withOfficeDbScope(pool, "", async () => {
      assert.equal(await count(pool), 0);
    });
    await withOfficeDbScope(pool, TENANT_DENY_SENTINEL, async () => {
      assert.equal(await count(pool), 0);
    });
    console.log("  ✅ T7 invalid/empty tenant fail-closed");

    /* Unbound pool.query checkouts are fail-closed (Invariant F) even after prior bypass. */
    await withBypassDbScope(pool, async () => {
      assert.equal(await count(pool), 2);
    });
    assert.equal(
      (await pool.query(`SELECT current_setting('app.bypass_rls', true) AS s`)).rows[0].s,
      "off",
    );
    assert.equal(await count(pool), 0);
    console.log("  ✅ unbound pool.query checkouts are fail-closed after privileged scope");

    await pool.end();
  }
}

console.log("\n═══ Contract: setters require scope ═══");
{
  const sess = readFileSync(join(ROOT, "artifacts/api-server/src/lib/tenantSession.ts"), "utf8");
  assert.match(sess, /requires an active pinned DB scope/);
  const auth = readFileSync(join(ROOT, "artifacts/api-server/src/middlewares/requireAuth.ts"), "utf8");
  assert.match(auth, /runWithOfficeDbScopeUntilResponse/);
  assert.match(auth, /runWithBypassDbScopeUntilResponse/);
  console.log("  ✅ middleware holds pinned scope for request lifetime");
}

console.log("\n✅ gucPoolContainmentP0: all checks passed\n");
