/**
 * Events Routes — SSE stream + event history + analytics
 */
import { Router, Request, Response } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { eventBus } from "../../core/eventBus";
import { EVENT_LABELS } from "../../core/listeners/analyticsListener";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

async function resolveReqTenantId(req: Request): Promise<string | null> {
  const existing = (req as any).tenantId as string | undefined;
  if (existing) return existing;
  const userId = (req as any).userId as string | undefined;
  if (!userId) return null;
  const { resolveTenantId } = await import("../../middlewares/tenantMiddleware");
  return resolveTenantId(userId, req.headers["x-tenant-id"] as string | undefined);
}

async function handleRecentEvents(req: Request, res: Response) {
  try {
    const tenantId = await resolveReqTenantId(req);
    if (!tenantId) { res.json({ events: [], total: 0 }); return; }
    const limit  = Math.min(parseInt(String(req.query.limit  ?? 50)), 200);
    const type   = req.query.type   as string | undefined;

    const rows = await db.execute(
      type
        ? sql`SELECT id, event_type, office_id, actor_id, payload, created_at FROM system_events WHERE event_type=${type} AND office_id=${tenantId} ORDER BY created_at DESC LIMIT ${limit}`
        : sql`SELECT id, event_type, office_id, actor_id, payload, created_at FROM system_events WHERE office_id=${tenantId} ORDER BY created_at DESC LIMIT ${limit}`
    );

    const events = (rows.rows as any[]).map(e => ({
      id:        e.id,
      type:      e.event_type,
      label:     (EVENT_LABELS as any)[e.event_type] ?? e.event_type,
      officeId:  e.office_id,
      actorId:   e.actor_id,
      data:      typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload,
      timestamp: e.created_at,
    }));

    res.json({ events, total: events.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

/* ── GET /api/events/stream — SSE real-time feed ── */
router.get("/events/stream", requireAuth, (req: Request, res: Response) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  /* Welcome ping */
  res.write(`data: ${JSON.stringify({ type: "__CONNECTED__", timestamp: new Date().toISOString() })}\n\n`);

  /* Keepalive every 25s */
  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { clearInterval(keepalive); }
  }, 25_000);

  /* Register with userId for targeted delivery (e.g. private message notifications) */
  const userId = (req as any).auth?.userId as string | undefined;
  eventBus.addSSEClient(res, userId);

  res.on("close", () => {
    clearInterval(keepalive);
  });
});

/* ── GET /api/events — alias for layout sidebar (limit query) ── */
router.get("/events", requireAuth, handleRecentEvents);

/* ── GET /api/events/recent — last N events ── */
router.get("/events/recent", requireAuth, handleRecentEvents);

/* ── GET /api/events/stats — counts by type (last 30d) ── */
router.get("/events/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = await resolveReqTenantId(req);
    if (!tenantId) { res.json({ total30d: 0, byType: [], byDay: [], liveClients: 0 }); return; }
    const [totals, byType, byDay] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) as total FROM system_events WHERE created_at > NOW() - INTERVAL '30 days' AND office_id=${tenantId}
      `),
      db.execute(sql`
        SELECT event_type, COUNT(*) as count
        FROM system_events
        WHERE created_at > NOW() - INTERVAL '30 days' AND office_id=${tenantId}
        GROUP BY event_type ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM system_events
        WHERE created_at > NOW() - INTERVAL '14 days' AND office_id=${tenantId}
        GROUP BY day ORDER BY day
      `),
    ]);

    res.json({
      total30d: Number((totals.rows[0] as any)?.total ?? 0),
      byType:   (byType.rows as any[]).map(r => ({
        type:  r.event_type,
        label: (EVENT_LABELS as any)[r.event_type] ?? r.event_type,
        count: Number(r.count),
      })),
      byDay:    (byDay.rows as any[]).map(r => ({
        day:   r.day,
        count: Number(r.count),
      })),
      liveClients: eventBus.clientCount,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
