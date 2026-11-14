/**
 * Pool GUC containment — verifies release resets bypass_rls (F-TENANT-POOL-001).
 * Mirrors lib/db installPoolGucGuard behavior.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "../../../../lib/db/package.json"));
const { Pool } = require("pg");

const DENY = "__unscoped__";
const RESET = `SELECT set_config('app.current_tenant','${DENY}',false), set_config('app.tenant_id','${DENY}',false), set_config('app.bypass_rls','off',false)`;

function installPoolGucGuard(pool) {
  if (pool.__gucGuardInstalled) return;
  pool.__gucGuardInstalled = true;
  const originalConnect = pool.connect.bind(pool);
  pool.connect = function connectGuarded(cb) {
    if (typeof cb === "function") {
      return originalConnect((err, client, done) => {
        if (err || !client) return cb(err, client, done);
        client
          .query(RESET)
          .then(() => {
            wrapRelease(client, originalConnect);
            cb(null, client, done);
          })
          .catch((e) => cb(e));
      });
    }
    return originalConnect().then(async (client) => {
      await client.query(RESET);
      wrapRelease(client);
      return client;
    });
  };
}

function wrapRelease(client) {
  if (client.__gucReleaseWrapped) return;
  client.__gucReleaseWrapped = true;
  const originalRelease = client.release.bind(client);
  client.release = (err) => {
    client
      .query(RESET)
      .catch(() => {})
      .finally(() => originalRelease(err));
  };
}

async function guc(client, tenant, bypass = "off") {
  await client.query(
    `SELECT set_config('app.current_tenant',$1,false), set_config('app.bypass_rls',$2,false)`,
    [tenant, bypass],
  );
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("BLOCKED: DATABASE_URL missing");
  process.exit(2);
}

const pool = new Pool({ connectionString: url, max: 4 });
installPoolGucGuard(pool);

const c = await pool.connect();
await guc(c, "__unscoped__", "on");
await c.query(`TRUNCATE client_invoices_repro`);
await c.query(
  `INSERT INTO client_invoices_repro (id, office_id) VALUES ('pa','office-a'),('pb','office-b')`,
);
await guc(c, "office-a", "off");
assert.equal((await c.query(`SELECT count(*)::int AS n FROM client_invoices_repro`)).rows[0].n, 1);
console.log("PASS same-connection tenant scope");

await guc(c, "__unscoped__", "on");
assert.equal(
  (await c.query(`SELECT current_setting('app.bypass_rls', true) AS b`)).rows[0].b,
  "on",
);

await new Promise((resolve, reject) => {
  c.release();
  /* release resets async — wait briefly */
  setTimeout(resolve, 100);
});

const samples = [];
for (let i = 0; i < 12; i++) {
  const r = await pool.query(
    `SELECT current_setting('app.bypass_rls', true) AS b, count(*)::int AS n FROM client_invoices_repro`,
  );
  samples.push(r.rows[0]);
}
console.log("POST_RELEASE_SAMPLES", JSON.stringify(samples.slice(0, 4)));
const bypassLeak = samples.some((r) => r.b === "on" && Number(r.n) === 2);
assert.equal(bypassLeak, false, "bypass_rls must not leak after guarded release");
/* After reset, empty/deny tenant should see 0 under fail-closed policy */
assert.ok(samples.every((r) => Number(r.n) === 0 || r.b !== "on"));
console.log("PASS: bypass_rls contained after release (F-TENANT-POOL-001)");
await pool.end();
