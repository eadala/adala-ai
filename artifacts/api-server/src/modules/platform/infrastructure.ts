/**
 * Infrastructure Management — لوحة البنية التحتية
 * ─────────────────────────────────────────────────────────────────────
 * Super Admin only.
 * Manages isolation tiers (shared / professional / enterprise) per office,
 * encryption keys, storage quotas, and DB stats.
 *
 * Routes (all under /admin/infrastructure):
 *   GET  /overview          — platform-wide summary
 *   GET  /offices           — per-office isolation matrix
 *   POST /offices/:id/isolation — set isolation mode
 *   POST /offices/:id/generate-key — generate encryption key
 *   GET  /db-stats          — database size & table row counts
 *   GET  /storage-matrix    — per-office storage breakdown
 */
import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createClerkClient, getAuth } from "@clerk/express";
import crypto from "crypto";

const router = Router();
const adminOnly = requireSuperAdmin;

/* ── helpers ────────────────────────────────────────────────── */
function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }

/* ── ensure tables ──────────────────────────────────────────── */
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS office_isolation_config (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id       TEXT NOT NULL UNIQUE,
      isolation_mode  TEXT NOT NULL DEFAULT 'shared',
        -- shared | professional | enterprise
      dedicated_db_url      TEXT,
      dedicated_bucket      TEXT,
      encryption_key_id     TEXT,
      encryption_key_hint   TEXT,
      backup_enabled        BOOLEAN DEFAULT FALSE,
      backup_frequency      TEXT DEFAULT 'daily',
      notes                 TEXT,
      upgraded_at           TIMESTAMPTZ,
      created_at            TIMESTAMPTZ DEFAULT NOW(),
      updated_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════
   GET /admin/infrastructure/overview
══════════════════════════════════════════════════════════════ */
router.get("/admin/infrastructure/overview", adminOnly, async (req, res) => {
  try {
    await ensureTables();

    const dbSize = one(await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
             pg_database_size(current_database()) AS bytes
    `));

    const officeCounts = one(await db.execute(sql`
      SELECT
        COUNT(*)::int                                                       AS total_offices,
        COUNT(*) FILTER (WHERE status = 'active')::int                     AS active_offices,
        COUNT(*) FILTER (WHERE subscription_plan = 'enterprise')::int      AS enterprise_offices
      FROM offices
    `));

    const isolationCounts = one(await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE isolation_mode = 'shared')::int       AS shared,
        COUNT(*) FILTER (WHERE isolation_mode = 'professional')::int  AS professional,
        COUNT(*) FILTER (WHERE isolation_mode = 'enterprise')::int    AS enterprise
      FROM office_isolation_config
    `));

    const storageTotal = one(await db.execute(sql`
      SELECT
        SUM(used_bytes)::bigint AS total_used,
        SUM(max_bytes)::bigint  AS total_quota,
        COUNT(*)::int           AS offices_with_storage
      FROM office_storage_quota
    `));

    const tableCount = one(await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `));

    res.json({
      database: { size: dbSize?.size, bytes: dbSize?.bytes, tables: tableCount?.count },
      offices: officeCounts,
      isolation: isolationCounts,
      storage: storageTotal,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════
   GET /admin/infrastructure/offices
══════════════════════════════════════════════════════════════ */
router.get("/admin/infrastructure/offices", adminOnly, async (req, res) => {
  try {
    await ensureTables();

    const offices = rows(await db.execute(sql`
      SELECT
        o.id::text,
        o.name,
        o.plan                                          AS subscription_plan,
        CASE WHEN o.is_published THEN 'active' ELSE 'inactive' END AS status,
        o.slug,
        o.created_at,
        COALESCE(oic.isolation_mode, 'shared')          AS isolation_mode,
        oic.dedicated_bucket,
        oic.encryption_key_id,
        oic.encryption_key_hint,
        oic.backup_enabled,
        oic.upgraded_at,
        COALESCE(osq.used_bytes, 0)::bigint             AS storage_used,
        COALESCE(osq.max_bytes, 524288000)::bigint      AS storage_quota,
        COALESCE(osq.files_count, 0)::int               AS files_count
      FROM office_page o
      LEFT JOIN office_isolation_config oic ON oic.office_id = o.id::text
      LEFT JOIN office_storage_quota    osq ON osq.office_id = o.id::text
      ORDER BY o.created_at DESC
    `));

    res.json(offices);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════
   POST /admin/infrastructure/offices/:id/isolation
══════════════════════════════════════════════════════════════ */
router.post("/admin/infrastructure/offices/:id/isolation", adminOnly, async (req, res) => {
  try {
    await ensureTables();
    const officeId = String(req.params.id);
    const { isolation_mode, dedicated_bucket, dedicated_db_url, backup_enabled, notes } = req.body;

    if (!["shared", "professional", "enterprise"].includes(isolation_mode))
      return res.status(400).json({ error: "وضع العزل غير صالح" });

    await db.execute(sql`
      INSERT INTO office_isolation_config
        (office_id, isolation_mode, dedicated_bucket, dedicated_db_url, backup_enabled, notes, upgraded_at)
      VALUES
        (${officeId}, ${isolation_mode}, ${dedicated_bucket ?? null},
         ${dedicated_db_url ?? null}, ${backup_enabled ?? false}, ${notes ?? null}, NOW())
      ON CONFLICT (office_id) DO UPDATE SET
        isolation_mode    = EXCLUDED.isolation_mode,
        dedicated_bucket  = COALESCE(EXCLUDED.dedicated_bucket, office_isolation_config.dedicated_bucket),
        dedicated_db_url  = COALESCE(EXCLUDED.dedicated_db_url, office_isolation_config.dedicated_db_url),
        backup_enabled    = EXCLUDED.backup_enabled,
        notes             = COALESCE(EXCLUDED.notes, office_isolation_config.notes),
        upgraded_at       = NOW(),
        updated_at        = NOW()
    `);

    res.json({ ok: true, isolation_mode });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════
   POST /admin/infrastructure/offices/:id/generate-key
══════════════════════════════════════════════════════════════ */
router.post("/admin/infrastructure/offices/:id/generate-key", adminOnly, async (req, res) => {
  try {
    await ensureTables();
    const officeId = String(req.params.id);

    /* Generate a unique key ID (we store only the hint, not the key itself) */
    const keyId   = `key_${crypto.randomBytes(8).toString("hex")}`;
    const keyHint = keyId.slice(0, 12) + "...";

    await db.execute(sql`
      INSERT INTO office_isolation_config (office_id, encryption_key_id, encryption_key_hint)
      VALUES (${officeId}, ${keyId}, ${keyHint})
      ON CONFLICT (office_id) DO UPDATE SET
        encryption_key_id   = EXCLUDED.encryption_key_id,
        encryption_key_hint = EXCLUDED.encryption_key_hint,
        updated_at          = NOW()
    `);

    res.json({ ok: true, keyHint });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════
   GET /admin/infrastructure/db-stats
══════════════════════════════════════════════════════════════ */
router.get("/admin/infrastructure/db-stats", adminOnly, async (req, res) => {
  try {
    const tables = rows(await db.execute(sql`
      SELECT
        t.table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) AS size,
        pg_total_relation_size(quote_ident(t.table_name)) AS bytes,
        COALESCE(s.n_live_tup, 0)::bigint AS row_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY pg_total_relation_size(quote_ident(t.table_name)) DESC
      LIMIT 30
    `));

    const connStats = one(await db.execute(sql`
      SELECT
        COUNT(*)::int                                             AS total_connections,
        COUNT(*) FILTER (WHERE state = 'active')::int           AS active_connections,
        COUNT(*) FILTER (WHERE state = 'idle')::int             AS idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `));

    res.json({ tables, connections: connStats });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════
   GET /admin/infrastructure/storage-matrix
══════════════════════════════════════════════════════════════ */
router.get("/admin/infrastructure/storage-matrix", adminOnly, async (req, res) => {
  try {
    const matrix = rows(await db.execute(sql`
      SELECT
        o.name   AS office_name,
        o.id     AS office_id,
        COALESCE(osq.used_bytes,  0)::bigint  AS used_bytes,
        COALESCE(osq.max_bytes,   524288000)::bigint AS max_bytes,
        COALESCE(osq.files_count, 0)::int     AS files_count,
        COALESCE(oic.isolation_mode, 'shared') AS isolation_mode,
        oic.dedicated_bucket
      FROM offices o
      LEFT JOIN office_storage_quota    osq ON osq.office_id = o.id
      LEFT JOIN office_isolation_config oic ON oic.office_id = o.id
      ORDER BY osq.used_bytes DESC NULLS LAST
    `));
    res.json(matrix);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
