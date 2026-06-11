import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// ─── GET /calendar/events ─────────────────────────────────────────────────────
router.get("/calendar/events", async (req: Request, res: Response) => {
  try {
    const { year, month, userId } = req.query as Record<string, string>;
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (year && month) {
      params.push(parseInt(year), parseInt(month));
      whereClause += ` AND EXTRACT(YEAR FROM start_at) = $${params.length - 1}
                       AND EXTRACT(MONTH FROM start_at) = $${params.length}`;
    }
    if (userId) {
      params.push(userId);
      whereClause += ` AND user_id = $${params.length}`;
    }

    const result = await db.execute(
      sql.raw(`SELECT * FROM events ${whereClause} ORDER BY start_at ASC`)
    );
    res.json(result.rows ?? []);
  } catch (e: any) {
    console.error("GET /calendar/events:", e);
    res.json([]);
  }
});

// ─── GET /calendar/events/upcoming ───────────────────────────────────────────
router.get("/calendar/events/upcoming", async (req: Request, res: Response) => {
  try {
    const { userId, days = "7" } = req.query as Record<string, string>;
    let whereClause = "WHERE start_at >= NOW() AND start_at <= NOW() + INTERVAL '1 day' * $1";
    const params: any[] = [parseInt(days)];

    if (userId) {
      params.push(userId);
      whereClause += ` AND user_id = $${params.length}`;
    }

    const result = await db.execute(
      sql.raw(`SELECT * FROM events ${whereClause} ORDER BY start_at ASC LIMIT 20`)
    );
    res.json(result.rows ?? []);
  } catch (e: any) {
    console.error("GET /calendar/events/upcoming:", e);
    res.json([]);
  }
});

// ─── POST /calendar/events ────────────────────────────────────────────────────
router.post("/calendar/events", async (req: Request, res: Response) => {
  try {
    const {
      userId, title, eventType = "other", startAt, endAt,
      allDay = false, caseId, clientId, location, description, reminders = []
    } = req.body;

    if (!userId || !title || !startAt) {
      res.status(400).json({ error: "userId وtitle وstartAt مطلوبة" }); return;
    }

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO events (id, user_id, title, event_type, start_at, end_at, all_day, case_id, client_id, location, description, status, created_at, updated_at)
      VALUES (${id}, ${userId}, ${title}, ${eventType}, ${startAt}::timestamp, ${endAt ? endAt + "::timestamp" : null}::timestamp, ${allDay}, ${caseId ?? null}, ${clientId ?? null}, ${location ?? null}, ${description ?? null}, 'upcoming', NOW(), NOW())
    `);

    // Insert reminders
    for (const rem of reminders as { minutesBefore: number; email?: string }[]) {
      const remId = randomUUID();
      await db.execute(sql`
        INSERT INTO reminders (id, event_id, notify_before_minutes, notification_type, sent, email, created_at)
        VALUES (${remId}, ${id}, ${rem.minutesBefore}, 'email', false, ${rem.email ?? null}, NOW())
      `);
    }

    const event = await db.execute(sql`SELECT * FROM events WHERE id = ${id}`);
    res.json(event.rows[0]);
  } catch (e: any) {
    console.error("POST /calendar/events:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /calendar/events/:id ─────────────────────────────────────────────────
router.put("/calendar/events/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title, eventType, startAt, endAt, allDay,
      caseId, clientId, location, description, status
    } = req.body;

    await db.execute(sql`
      UPDATE events SET
        title = COALESCE(${title ?? null}, title),
        event_type = COALESCE(${eventType ?? null}, event_type),
        start_at = COALESCE(${startAt ? startAt + "::timestamp" : null}::timestamp, start_at),
        end_at = COALESCE(${endAt ? endAt + "::timestamp" : null}::timestamp, end_at),
        all_day = COALESCE(${allDay ?? null}, all_day),
        case_id = COALESCE(${caseId ?? null}, case_id),
        client_id = COALESCE(${clientId ?? null}, client_id),
        location = COALESCE(${location ?? null}, location),
        description = COALESCE(${description ?? null}, description),
        status = COALESCE(${status ?? null}, status),
        updated_at = NOW()
      WHERE id = ${id}
    `);

    const updated = await db.execute(sql`SELECT * FROM events WHERE id = ${id}`);
    res.json(updated.rows[0] ?? { error: "not found" });
  } catch (e: any) {
    console.error("PUT /calendar/events/:id:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /calendar/events/:id ──────────────────────────────────────────────
router.delete("/calendar/events/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM reminders WHERE event_id = ${id}`);
    await db.execute(sql`DELETE FROM events WHERE id = ${id}`);
    res.json({ success: true });
  } catch (e: any) {
    console.error("DELETE /calendar/events/:id:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /calendar/reminders ──────────────────────────────────────────────────
router.get("/calendar/reminders", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.query as Record<string, string>;
    const rows = await db.execute(
      sql`SELECT * FROM reminders WHERE event_id = ${eventId} ORDER BY notify_before_minutes ASC`
    );
    res.json(rows.rows ?? []);
  } catch (e: any) {
    res.json([]);
  }
});

export default router;
