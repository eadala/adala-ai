/**
 * ADALA-SEC-TENANT-P0-006 — pool GUC containment against isolated RLS DB.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installPoolGucGuard, TENANT_DENY_SENTINEL } from "@workspace/db";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../../../../lib/db/package.json"));
 
const { Pool } = require("pg") as {
  Pool: new (cfg: { connectionString?: string; max?: number }) => {
    connect: () => Promise<{
      query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
      release: () => void;
    }>;
    end: () => Promise<void>;
  };
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("BLOCKED: DATABASE_URL missing");
  process.exit(2);
}

const OFFICE_A = "c9efc92a-41ab-46b4-9aa1-baf867882149";
const OFFICE_B = "cfee909e-5821-4085-8c6a-90a3852ae437";

const pool = new Pool({ connectionString: url, max: 2 });
installPoolGucGuard(pool as never);

const results: { id: string; ok: boolean; detail: string }[] = [];

async function main() {
  const admin = await pool.connect();
  await admin.query(`
    CREATE TABLE IF NOT EXISTS pool_guc_probe (
      id text PRIMARY KEY,
      office_id text NOT NULL
    )
  `);
  await admin.query(`ALTER TABLE pool_guc_probe ENABLE ROW LEVEL SECURITY`);
  await admin.query(`ALTER TABLE pool_guc_probe FORCE ROW LEVEL SECURITY`);
  await admin.query(`DROP POLICY IF EXISTS tenant_iso ON pool_guc_probe`);
  await admin.query(`
    CREATE POLICY tenant_iso ON pool_guc_probe
    USING (
      current_setting('app.bypass_rls', true) = 'on'
      OR (
        nullif(current_setting('app.current_tenant', true), '') IS NOT NULL
        AND office_id = current_setting('app.current_tenant', true)
      )
    )
  `);
  await admin.query(`TRUNCATE pool_guc_probe`);
  await admin.query(`SELECT set_config('app.bypass_rls','on',false)`);
  await admin.query(`INSERT INTO pool_guc_probe (id, office_id) VALUES ('pa',$1),('pb',$2)`, [OFFICE_A, OFFICE_B]);
  await admin.query(`SELECT set_config('app.bypass_rls','off',false), set_config('app.current_tenant',$1,false)`, [TENANT_DENY_SENTINEL]);
  admin.release();

  const c1 = await pool.connect();
  const n0 = (await c1.query(`SELECT count(*)::int n FROM pool_guc_probe`)).rows[0].n;
  assert.equal(n0, 0);
  results.push({ id: "CHECKOUT_FAILCLOSED", ok: true, detail: `n=${n0}` });

  await c1.query(`SELECT set_config('app.current_tenant',$1,false), set_config('app.bypass_rls','off',false)`, [OFFICE_A]);
  assert.equal((await c1.query(`SELECT count(*)::int n FROM pool_guc_probe`)).rows[0].n, 1);
  await c1.query(`SELECT set_config('app.bypass_rls','on',false)`);
  c1.release();

  const c2 = await pool.connect();
  const after = await c2.query(`SELECT current_setting('app.bypass_rls', true) b, current_setting('app.current_tenant', true) t`);
  assert.equal(after.rows[0].b, "off");
  assert.equal(after.rows[0].t, TENANT_DENY_SENTINEL);
  assert.equal((await c2.query(`SELECT count(*)::int n FROM pool_guc_probe`)).rows[0].n, 0);
  results.push({ id: "RELEASE_CLEARS_BYPASS", ok: true, detail: JSON.stringify(after.rows[0]) });
  c2.release();

  console.log(JSON.stringify({ suite: "pool-guc-containment", passed: results.length, failed: 0, skipped: 0, results }, null, 2));
  await pool.end();
  console.log("PASS pool GUC containment");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
