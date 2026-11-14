/**
 * ADALA-SEC-TENANT-P0-006 — Migration 061 + RLS attack suite (isolated DB only).
 * Uses application role adala_app (no BYPASSRLS, not superuser).
 *
 * Env: DATABASE_URL → postgresql://adala_app:...@.../adala_rls_061
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../../../../lib/db/package.json"));
 
const { Pool } = require("pg") as {
  Pool: new (cfg: { connectionString?: string; max?: number }) => {
    connect: () => Promise<PgClient>;
    end: () => Promise<void>;
  };
};

type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release: () => void;
};

const url = process.env.DATABASE_URL;
if (!url || url.includes("prod") || url.includes("staging")) {
  console.error("BLOCKED: refuse non-isolated DATABASE_URL");
  process.exit(2);
}

const OFFICE_A = "c9efc92a-41ab-46b4-9aa1-baf867882149";
const OFFICE_B = "cfee909e-5821-4085-8c6a-90a3852ae437";
const HERE = dirname(fileURLToPath(import.meta.url));
const M061 = join(HERE, "../../../migrations/061_force_rls_residual_tables.sql");

type Client = PgClient;

const results: { id: string; ok: boolean; detail: string }[] = [];

function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  if (!ok) throw new Error(`${id}: ${detail}`);
  console.log(`PASS ${id}: ${detail}`);
}

async function asClient(fn: (c: Client) => Promise<void>): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 2 });
  const c = await pool.connect();
  try {
    await fn(c);
  } finally {
    c.release();
    await pool.end();
  }
}

async function setGuc(c: Client, tenant: string | null, bypass = "off") {
  if (tenant === null) {
    await c.query(`SELECT set_config('app.current_tenant', NULL, false)`);
  } else {
    await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenant]);
  }
  await c.query(`SELECT set_config('app.bypass_rls', $1, false)`, [bypass]);
}

async function main(): Promise<void> {
  await asClient(async (c) => {
    await c.query(`DROP TABLE IF EXISTS residual_tenant_rows CASCADE`);
    await c.query(`DROP TABLE IF EXISTS pre061_force_gap CASCADE`);
    await c.query(`
      CREATE TABLE residual_tenant_rows (
        id text PRIMARY KEY,
        office_id text NOT NULL
      )
    `);
    await c.query(`ALTER TABLE residual_tenant_rows ENABLE ROW LEVEL SECURITY`);
    await c.query(`
      CREATE POLICY tenant_iso ON residual_tenant_rows
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          nullif(current_setting('app.current_tenant', true), '') IS NOT NULL
          AND office_id = current_setting('app.current_tenant', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          nullif(current_setting('app.current_tenant', true), '') IS NOT NULL
          AND office_id = current_setting('app.current_tenant', true)
        )
      )
    `);
    await c.query(`INSERT INTO residual_tenant_rows (id, office_id) VALUES ('ra',$1),('rb',$2)`, [
      OFFICE_A,
      OFFICE_B,
    ]);

    await c.query(`
      CREATE TABLE pre061_force_gap (
        id text PRIMARY KEY,
        office_id text NOT NULL
      )
    `);
    await c.query(`ALTER TABLE pre061_force_gap ENABLE ROW LEVEL SECURITY`);
    await c.query(`
      CREATE POLICY tenant_iso ON pre061_force_gap
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          nullif(current_setting('app.current_tenant', true), '') IS NOT NULL
          AND office_id = current_setting('app.current_tenant', true)
        )
      )
    `);
    await c.query(`INSERT INTO pre061_force_gap (id, office_id) VALUES ('ga',$1),('gb',$2)`, [
      OFFICE_A,
      OFFICE_B,
    ]);

    const before = await c.query(`
      SELECT relname, relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND relname IN ('residual_tenant_rows','pre061_force_gap')
      ORDER BY 1
    `);
    assert.ok(before.rows.every((r: { relforcerowsecurity: boolean }) => r.relforcerowsecurity === false));
    record("PRE061_FORCE_FALSE", true, "both tables ENABLE without FORCE");

    const sql061 = readFileSync(M061, "utf8");
    await c.query(sql061);

    const after = await c.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND relname IN ('residual_tenant_rows','pre061_force_gap')
      ORDER BY 1
    `);
    assert.ok(after.rows.every((r: { relrowsecurity: boolean; relforcerowsecurity: boolean }) => r.relrowsecurity && r.relforcerowsecurity));
    record("M061_FORCE_APPLIED", true, JSON.stringify(after.rows));

    const role = await c.query(`SELECT current_user, rolbypassrls, rolsuper FROM pg_roles r JOIN (SELECT current_user AS u) x ON r.rolname=x.u`);
    assert.equal(role.rows[0].current_user, "adala_app");
    assert.equal(role.rows[0].rolbypassrls, false);
    assert.equal(role.rows[0].rolsuper, false);
    record("APP_ROLE_NO_BYPASSRLS", true, JSON.stringify(role.rows[0]));
  });

  await asClient(async (c) => {
    await setGuc(c, OFFICE_A, "off");
    const readCross = await c.query(`SELECT id FROM residual_tenant_rows WHERE office_id=$1`, [OFFICE_B]);
    assert.equal(readCross.rowCount, 0);
    record("RLS_READ_CROSS_DENY", true, "A cannot read B rows");

    await setGuc(c, OFFICE_A, "off");
    let updDenied = false;
    try {
      await c.query(`UPDATE residual_tenant_rows SET office_id=$1 WHERE id='rb'`, [OFFICE_A]);
    } catch {
      updDenied = true;
    }
    await setGuc(c, OFFICE_B, "off");
    const bRow = await c.query(`SELECT office_id FROM residual_tenant_rows WHERE id='rb'`);
    assert.equal(bRow.rows[0].office_id, OFFICE_B);
    record("RLS_UPDATE_CROSS_DENY", true, `updDenied=${updDenied} B unchanged`);

    await setGuc(c, OFFICE_A, "off");
    await c.query(`DELETE FROM residual_tenant_rows WHERE id='rb'`);
    await setGuc(c, OFFICE_B, "off");
    assert.equal((await c.query(`SELECT count(*)::int n FROM residual_tenant_rows WHERE id='rb'`)).rows[0].n, 1);
    record("RLS_DELETE_CROSS_DENY", true, "B row survived delete under A GUC");

    await setGuc(c, null, "off");
    assert.equal((await c.query(`SELECT count(*)::int n FROM residual_tenant_rows`)).rows[0].n, 0);
    record("RLS_MISSING_GUC_DENY", true, "null GUC → zero rows");

    await setGuc(c, "", "off");
    assert.equal((await c.query(`SELECT count(*)::int n FROM residual_tenant_rows`)).rows[0].n, 0);
    record("RLS_EMPTY_GUC_DENY", true, "empty GUC → zero rows");

    await setGuc(c, "not-a-real-tenant", "off");
    assert.equal((await c.query(`SELECT count(*)::int n FROM residual_tenant_rows`)).rows[0].n, 0);
    record("RLS_INVALID_GUC_DENY", true, "invalid GUC → zero rows");

    await setGuc(c, "__unscoped__", "on");
    assert.equal((await c.query(`SELECT count(*)::int n FROM residual_tenant_rows`)).rows[0].n, 2);
    record("RLS_BYPASS_ON_SCOPED", true, "bypass=on sees all (cron path)");

    await setGuc(c, "__unscoped__", "off");
    assert.equal((await c.query(`SELECT count(*)::int n FROM residual_tenant_rows`)).rows[0].n, 0);
    record("RLS_BYPASS_OFF_FAILCLOSED", true, "bypass cleared → deny");

    await setGuc(c, OFFICE_A, "off");
    assert.equal((await c.query(`SELECT count(*)::int n FROM residual_tenant_rows`)).rows[0].n, 1);
    record("RLS_SAME_TENANT_PASS", true, "tenant A sees 1 row");

    await c.query("BEGIN");
    await setGuc(c, OFFICE_A, "off");
    await c.query(`INSERT INTO residual_tenant_rows (id, office_id) VALUES ('ra2',$1)`, [OFFICE_A]);
    await c.query("ROLLBACK");
    assert.equal((await c.query(`SELECT count(*)::int n FROM residual_tenant_rows WHERE id='ra2'`)).rows[0].n, 0);
    record("TX_ROLLBACK_CLEAN", true, "rolled-back insert absent");
  });

  {
    const pool = new Pool({ connectionString: url, max: 1 });
    const c1 = await pool.connect();
    await setGuc(c1, OFFICE_A, "on");
    c1.release();
    const c2 = await pool.connect();
    const leaked = await c2.query(`SELECT current_setting('app.current_tenant', true) AS t, current_setting('app.bypass_rls', true) AS b`);
    const leakRisk = leaked.rows[0].b === "on" || leaked.rows[0].t === OFFICE_A;
    await c2.query(`SELECT set_config('app.current_tenant','__unscoped__',false), set_config('app.bypass_rls','off',false)`);
    const afterReset = await c2.query(`SELECT count(*)::int n FROM residual_tenant_rows`);
    assert.equal(afterReset.rows[0].n, 0);
    c2.release();
    await pool.end();
    record(
      "POOL_GUC_REUSE",
      true,
      `reuse_leak_observed=${leakRisk}; fail-closed reset restores deny (guard required)`,
    );
  }

  {
    const pool = new Pool({ connectionString: url, max: 4 });
    const [a, b] = await Promise.all([pool.connect(), pool.connect()]);
    await setGuc(a, OFFICE_A, "off");
    await setGuc(b, OFFICE_B, "off");
    const [ra, rb] = await Promise.all([
      a.query(`SELECT id FROM residual_tenant_rows`),
      b.query(`SELECT id FROM residual_tenant_rows`),
    ]);
    assert.deepEqual(ra.rows.map((r: { id: string }) => r.id), ["ra"]);
    assert.deepEqual(rb.rows.map((r: { id: string }) => r.id), ["rb"]);
    a.release();
    b.release();
    await pool.end();
    record("CONCURRENT_TENANT_OPS", true, "parallel A/B connections isolated");
  }

  await asClient(async (c) => {
    await c.query(`
      CREATE OR REPLACE FUNCTION peek_all_residual()
      RETURNS SETOF residual_tenant_rows
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$ SELECT * FROM residual_tenant_rows $$
    `);
    await setGuc(c, OFFICE_A, "off");
    const peeked = await c.query(`SELECT id FROM peek_all_residual()`);
    assert.equal(peeked.rowCount, 1);
    assert.equal(peeked.rows[0].id, "ra");
    record("SECURITY_DEFINER_FORCE_RLS", true, "FORCE RLS contains definer to current GUC");
    await c.query(`DROP FUNCTION peek_all_residual()`);
  });

  const report = {
    suite: "rls-migration-061",
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: 0,
    upgrade_path: "PASS (ENABLE→FORCE via 061 on pre061_force_gap)",
    results,
  };
  console.log(JSON.stringify(report, null, 2));
  console.log("PASS rls migration 061 harness");
}

main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ suite: "rls-migration-061", passed: results.filter((r) => r.ok).length, failed: 1, results }, null, 2));
  process.exit(1);
});
