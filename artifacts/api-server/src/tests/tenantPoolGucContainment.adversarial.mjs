/**
 * ADALA-ARC-TENANT-SECURITY-004 — pool GUC adversarial evidence (synthetic DB).
 * Run from repo: node artifacts/api-server/src/tests/tenantPoolGucContainment.adversarial.mjs
 * (cwd with pg resolvable via lib/db)
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "../../../../lib/db/package.json"));
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("BLOCKED: DATABASE_URL missing");
  process.exit(2);
}

async function guc(client, tenant, bypass = "off") {
  await client.query(
    `SELECT set_config('app.current_tenant',$1,false), set_config('app.bypass_rls',$2,false)`,
    [tenant, bypass],
  );
}

const pool = new Pool({ connectionString: url, max: 4 });
const c = await pool.connect();
try {
  await guc(c, "__unscoped__", "on");
  await c.query(`TRUNCATE client_invoices_repro`);
  await c.query(
    `INSERT INTO client_invoices_repro (id, office_id) VALUES ('pa','office-a'),('pb','office-b')`,
  );

  await guc(c, "office-a", "off");
  assert.equal((await c.query(`SELECT count(*)::int AS n FROM client_invoices_repro`)).rows[0].n, 1);
  assert.equal(
    (await c.query(`SELECT count(*)::int AS n FROM client_invoices_repro WHERE office_id='office-b'`))
      .rows[0].n,
    0,
  );
  assert.equal(
    (await c.query(`UPDATE client_invoices_repro SET id=id WHERE office_id='office-b'`)).rowCount,
    0,
  );
  assert.equal(
    (await c.query(`DELETE FROM client_invoices_repro WHERE office_id='office-b'`)).rowCount,
    0,
  );
  await guc(c, "", "off");
  assert.equal((await c.query(`SELECT count(*)::int AS n FROM client_invoices_repro`)).rows[0].n, 0);
  await guc(c, "__unscoped__", "off");
  assert.equal((await c.query(`SELECT count(*)::int AS n FROM client_invoices_repro`)).rows[0].n, 0);
  console.log("PASS same-connection fail-closed RLS matrix");

  await guc(c, "__unscoped__", "on");
  c.release();
  const leaked = [];
  for (let i = 0; i < 10; i++) {
    const r = await pool.query(
      `SELECT current_setting('app.bypass_rls', true) AS b, count(*)::int AS n FROM client_invoices_repro`,
    );
    leaked.push(r.rows[0]);
  }
  const bypassLeak = leaked.some((r) => r.b === "on" && Number(r.n) === 2);
  console.log("BYPASS_LEAK_SAMPLES", JSON.stringify(leaked.slice(0, 3)));
  assert.equal(bypassLeak, true);
  console.log("CONFIRMED: BYPASS_RLS leaks to subsequent pool.query (F-TENANT-POOL-001)");
} finally {
  await pool.end();
}
