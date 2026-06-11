/**
 * Calendar routes — fixed:
 *  1. sql.raw() with unbound $N params replaced with parameterized sql`` tags
 *  2. Auth (getAuth) added to write operations
 *  3. userId resolved server-side from Clerk instead of query param
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";

const router = Router();

/* helper */
async function dbRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

// ─── GET /calendar/events ──────────────────────────────────────────────────────
router.get("/calendar/events", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const { year, month } = req.query as Record<string, string>;
    const y = year  ? parseInt(year,  10) : null;
    const m = month ? parseInt(month, 10) : null;

    let rows: any[];
    if (y && m) {
      rows = await dbRows(sql`
        SELECT * FROM events
        WHERE user_id = ${authUserId}
          AND EXTRACT(YEAR  FROM start_at) = ${y}
          AND EXTRACT(MONTH FROM start_at) = ${m}
        ORDER BY start_at ASC
      `);
    } else {
      rows = await dbRows(sql`
        SELECT * FROM events
        WHERE user_id = ${authUserId}
        ORDER BY start_at ASC
        LIMIT 200
      `);
    }
    res.json(rows);
  } catch (e: any) {
    console.error("GET /calendar/events:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /calendar/events/upcoming ────────────────────────────────────────────
router.get("/calendar/events/upcoming", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const rawDays = parseInt(String(req.query.days ?? "7"), 10);
    const days = isNaN(rawDays) || rawDays < 1 || rawDays > 365 ? 7 : rawDays;

    const rows = await dbRows(sql`
      SELECT * FROM events
      WHERE user_id = ${authUserId}
        AND start_at >= NOW()
        AND start_at <= NOW() + (${days} || ' days')::INTERVAL
      ORDER BY start_at ASC
      LIMIT 20
    `);
    res.json(rows);
  } catch (e: any) {
    console.error("GET /calendar/events/upcoming:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /calendar/events ─────────────────────────────────────────────────────
router.post("/calendar/events", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const {
      title, eventType = "other", startAt, endAt,
      allDay = false, caseId, clientId, location, description, reminders = []
    } = req.body;

    if (!title || !startAt) {
      return res.status(400).json({ error: "title وstartAt مطلوبان" });
    }

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO events
        (id, user_id, title, event_type, start_at, end_at, all_day,
         case_id, client_id, location, description, status, created_at, updated_at)
      VALUES
        (${id}, ${authUserId}, ${title}, ${eventType},
         ${startAt}::timestamptz,
         ${endAt ? endAt : null}::timestamptz,
         ${allDay}, ${caseId ?? null}, ${clientId ?? null},
         ${location ?? null}, ${description ?? null},
         'upcoming', NOW(), NOW())
    `);

    for (const rem of reminders as { minutesBefore: number; email?: string }[]) {
      const remId = randomUUID();
      await db.execute(sql`
        INSERT INTO reminders
          (id, event_id, notify_before_minutes, notification_type, sent, email, created_at)
        VALUES
          (${remId}, ${id}, ${rem.minutesBefore ?? 30}, 'email',
           false, ${rem.email ?? null}, NOW())
      `);
    }

    const rows = await dbRows(sql`SELECT * FROM events WHERE id = ${id}`);
    res.json(rows[0]);
  } catch (e: any) {
    console.error("POST /calendar/events:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /calendar/events/:id ──────────────────────────────────────────────────
router.put("/calendar/events/:id", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const { id } = req.params;

    /* Ownership check */
    const existing = await dbRows(sql`SELECT user_id FROM events WHERE id = ${id}`);
    if (!existing.length) return res.status(404).json({ error: "الحدث غير موجود" });
    if (existing[0].user_id !== authUserId) return res.status(403).json({ error: "غير مصرح" });

    const {
      title, eventType, startAt, endAt, allDay,
      caseId, clientId, location, description, status
    } = req.body;

    await db.execute(sql`
      UPDATE events SET
        title       = COALESCE(${title ?? null}, title),
        event_type  = COALESCE(${eventType ?? null}, event_type),
        start_at    = COALESCE(${startAt ? startAt : null}::timestamptz, start_at),
        end_at      = COALESCE(${endAt   ? endAt   : null}::timestamptz, end_at),
        all_day     = COALESCE(${allDay  ?? null}, all_day),
        case_id     = COALESCE(${caseId  ?? null}, case_id),
        client_id   = COALESCE(${clientId ?? null}, client_id),
        location    = COALESCE(${location ?? null}, location),
        description = COALESCE(${description ?? null}, description),
        status      = COALESCE(${status  ?? null}, status),
        updated_at  = NOW()
      WHERE id = ${id}
    `);

    const updated = await dbRows(sql`SELECT * FROM events WHERE id = ${id}`);
    res.json(updated[0] ?? { error: "not found" });
  } catch (e: any) {
    console.error("PUT /calendar/events/:id:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /calendar/events/:id ──────────────────────────────────────────────
router.delete("/calendar/events/:id", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const { id } = req.params;

    /* Ownership check */
    const existing = await dbRows(sql`SELECT user_id FROM events WHERE id = ${id}`);
    if (!existing.length) return res.status(404).json({ error: "الحدث غير موجود" });
    if (existing[0].user_id !== authUserId) return res.status(403).json({ error: "غير مصرح" });

    await db.execute(sql`DELETE FROM reminders WHERE event_id = ${id}`);
    await db.execute(sql`DELETE FROM events     WHERE id = ${id}`);
    res.json({ success: true });
  } catch (e: any) {
    console.error("DELETE /calendar/events/:id:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /calendar/reminders ───────────────────────────────────────────────────
router.get("/calendar/reminders", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const { eventId } = req.query as Record<string, string>;
    if (!eventId) return res.json([]);

    /* Verify event belongs to user */
    const evt = await dbRows(sql`SELECT user_id FROM events WHERE id = ${eventId}`);
    if (!evt.length || evt[0].user_id !== authUserId) return res.status(403).json({ error: "غير مصرح" });

    const rows = await dbRows(sql`
      SELECT * FROM reminders
      WHERE event_id = ${eventId}
      ORDER BY notify_before_minutes ASC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
