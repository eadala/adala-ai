import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ── Ensure tables exist ─────────────────────────────────────────────────── */
async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS web_vitals (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      value       NUMERIC NOT NULL,
      rating      TEXT NOT NULL CHECK (rating IN ('good','needs-improvement','poor')),
      url         TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS route_analytics (
      id            SERIAL PRIMARY KEY,
      path          TEXT NOT NULL,
      name_internal TEXT,
      module        TEXT,
      load_ms       INTEGER,
      visited_at    TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_route_analytics_path ON route_analytics(path);
  `);
}
ensureTable().catch(() => {});

/* ── POST /api/metrics/vitals ─────────────────────────────────────────────
 * Receives Web Vitals data from the frontend (fire-and-forget).
 * Public endpoint — no auth required (beacon API has no headers).
 */
router.post("/vitals", async (req, res) => {
  try {
    await ensureTable();

    let body: Record<string, unknown> = {};
    if (typeof req.body === "string" && req.body.length) {
      try { body = JSON.parse(req.body); } catch { body = {}; }
    } else if (req.body && typeof req.body === "object") {
      body = req.body;
    }
    const name = typeof body.name === "string" ? body.name : "";
    const rating = typeof body.rating === "string" ? body.rating : "";
    const value = body.value;
    const url = typeof body.url === "string" ? body.url : null;
    if (!name || value == null) return res.status(204).end();

    const validNames  = ["LCP", "INP", "CLS", "FCP", "TTFB"];
    const validRatings = ["good", "needs-improvement", "poor"];
    if (!validNames.includes(name) || !validRatings.includes(rating)) {
      return res.status(204).end();
    }

    await db.execute(sql`
      INSERT INTO web_vitals (name, value, rating, url)
      VALUES (${name}, ${Number(value)}, ${rating}, ${url ?? null})
    `);
    res.status(204).end();
  } catch {
    res.status(204).end(); // always 204 — frontend fire-and-forget
  }
});

/* ── GET /api/metrics/vitals/summary ──────────────────────────────────────
 * Returns aggregated Web Vitals for the last 7 days.
 * Requires admin auth.
 */
router.get("/vitals/summary", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        name,
        COUNT(*)                              AS total,
        ROUND(AVG(value)::numeric, 2)         AS avg_value,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value)::numeric, 2) AS p75,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::numeric, 2) AS p95,
        SUM(CASE WHEN rating = 'good'               THEN 1 ELSE 0 END) AS good_count,
        SUM(CASE WHEN rating = 'needs-improvement'  THEN 1 ELSE 0 END) AS needs_improvement_count,
        SUM(CASE WHEN rating = 'poor'               THEN 1 ELSE 0 END) AS poor_count
      FROM web_vitals
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY name
      ORDER BY name
    `);
    const data = Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows ?? [];
    res.json({ vitals: data, period: "7d" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── POST /api/metrics/route-analytics ───────────────────────────────────
 * Receives batch route visit events from the frontend.
 * Fire-and-forget — always returns 204.
 */
router.post("/route-analytics", async (req, res) => {
  try {
    await ensureTable();

    let payload = req.body ?? {};
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    const visits: Array<{
      path?: string;
      nameInternal?: string;
      module?: string;
      loadMs?: number;
      ts?: number;
    }> = Array.isArray(payload?.visits) ? payload.visits : [];

    for (const v of visits.slice(0, 200)) {
      if (!v.path || typeof v.path !== "string") continue;
      await db.execute(sql`
        INSERT INTO route_analytics (path, name_internal, module, load_ms, visited_at)
        VALUES (
          ${v.path},
          ${v.nameInternal ?? null},
          ${v.module ?? null},
          ${v.loadMs != null ? Number(v.loadMs) : null},
          ${v.ts ? new Date(v.ts).toISOString() : new Date().toISOString()}
        )
      `);
    }
    res.status(204).end();
  } catch {
    res.status(204).end();
  }
});

/* ── GET /api/metrics/route-analytics/summary ────────────────────────────
 * Returns top routes by visit count for the last 30 days.
 */
router.get("/route-analytics/summary", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        path,
        name_internal,
        module,
        COUNT(*)                              AS visits,
        ROUND(AVG(load_ms)::numeric, 0)       AS avg_load_ms,
        MAX(visited_at)                       AS last_seen
      FROM route_analytics
      WHERE visited_at >= NOW() - INTERVAL '30 days'
      GROUP BY path, name_internal, module
      ORDER BY visits DESC
      LIMIT 50
    `);
    const data = Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows ?? [];
    res.json({ routes: data, period: "30d" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
