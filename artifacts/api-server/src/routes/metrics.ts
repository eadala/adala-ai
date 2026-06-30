import { Router } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

const router = Router();

/* ── Ensure table exists ─────────────────────────────────────────────────── */
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
}
ensureTable().catch(() => {});

/* ── POST /api/metrics/vitals ─────────────────────────────────────────────
 * Receives Web Vitals data from the frontend (fire-and-forget).
 * Public endpoint — no auth required (beacon API has no headers).
 */
router.post("/vitals", async (req, res) => {
  try {
    const { name, value, rating, url } = req.body ?? {};
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

export default router;
