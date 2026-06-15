import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
const startedAt = Date.now();

router.get("/healthz", async (_req, res) => {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
  let dbStatus = "connected";
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbStatus = "error";
  }
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    db: dbStatus,
    dbLatencyMs,
    uptimeSec,
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

/* Alias: /health (without z) */
router.get("/health", (_req, res) => res.redirect("/api/healthz"));

export default router;
