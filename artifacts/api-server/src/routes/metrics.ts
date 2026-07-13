import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logEndpointError } from "../lib/endpointErrorLog";

const router = Router();

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "42P01" || /relation .+ does not exist/i.test(e?.message ?? "");
}

function schemaMissing(res: import("express").Response, table: string) {
  return res.status(503).json({
    error: `جدول ${table} غير موجود — طبّق migration 006_post_migration_api_support.sql`,
    code: "SCHEMA_MISSING",
    table,
    migration: "006_post_migration_api_support.sql",
  });
}

/* ── POST /api/metrics/vitals ─────────────────────────────────────────────
 * Receives Web Vitals data from the frontend (fire-and-forget).
 * Public endpoint — no auth required (beacon API has no headers).
 * Body may arrive as a raw JSON string (sendBeacon without Content-Type).
 */
router.post("/vitals", async (req, res) => {
  try {
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
  } catch (err) {
    if (isMissingRelation(err)) return schemaMissing(res, "web_vitals");
    logEndpointError("POST /api/metrics/vitals", req, err);
    res.status(204).end(); // other errors — fire-and-forget
  }
});

/* ── GET /api/metrics/vitals/summary ──────────────────────────────────────
 * Returns aggregated Web Vitals for the last 7 days.
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
    if (isMissingRelation(e)) return schemaMissing(res, "web_vitals");
    logEndpointError("GET /api/metrics/vitals/summary", _req, e);
    res.status(500).json({ error: String(e) });
  }
});

/* ── POST /api/metrics/route-analytics ───────────────────────────────────
 * Receives batch route visit events from the frontend.
 */
router.post("/route-analytics", async (req, res) => {
  try {
    let payload: Record<string, unknown> = {};
    if (typeof req.body === "string" && req.body.length) {
      try { payload = JSON.parse(req.body); } catch { payload = {}; }
    } else if (req.body && typeof req.body === "object") {
      payload = req.body;
    }
    const visits: Array<{
      path?: string;
      nameInternal?: string;
      module?: string;
      loadMs?: number;
      ts?: number;
    }> = Array.isArray(payload?.visits) ? (payload.visits as any[]) : [];

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
  } catch (err) {
    if (isMissingRelation(err)) return schemaMissing(res, "route_analytics");
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
    if (isMissingRelation(e)) return schemaMissing(res, "route_analytics");
    res.status(500).json({ error: String(e) });
  }
});

export default router;
