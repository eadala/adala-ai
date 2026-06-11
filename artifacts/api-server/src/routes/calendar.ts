import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";

const router = Router();

async function dbRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS events (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      office_id    TEXT NOT NULL DEFAULT 'default',
      title        TEXT NOT NULL,
      event_type   TEXT NOT NULL DEFAULT 'other',
      start_at     TIMESTAMPTZ NOT NULL,
      end_at       TIMESTAMPTZ,
      all_day      BOOLEAN NOT NULL DEFAULT FALSE,
      case_id      TEXT,
      client_id    TEXT,
      location     TEXT,
      description  TEXT,
      status       TEXT NOT NULL DEFAULT 'upcoming',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS event_reminders (
      id                     TEXT PRIMARY KEY,
      event_id               TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      notify_before_minutes  INTEGER NOT NULL DEFAULT 60,
      notification_type      TEXT NOT NULL DEFAULT 'email',
      email                  TEXT,
      sent                   BOOLEAN NOT NULL DEFAULT FALSE,
      sent_at                TIMESTAMPTZ,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function escapeIcal(s: string): string {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcalDate(dateStr: string, allDay = false): string {
  const d = new Date(dateStr);
  if (allDay) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// ─── GET /calendar/events ───────────────────────────────────────────────────
router.get("/calendar/events", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });
    await ensureTables();

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
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /calendar/events/export.ics ────────────────────────────────────────
router.get("/calendar/events/export.ics", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });
    await ensureTables();

    const rows = await dbRows(sql`
      SELECT * FROM events
      WHERE user_id = ${authUserId}
      ORDER BY start_at ASC
      LIMIT 500
    `);

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Adala AI//Legal Calendar//AR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:عدالة AI - التقويم القانوني",
      "X-WR-TIMEZONE:Asia/Riyadh",
    ];

    for (const ev of rows) {
      const uid = `${ev.id}@adala-ai.com`;
      const dtStamp = toIcalDate(ev.created_at ?? new Date().toISOString());
      const dtStart = ev.all_day
        ? `DTSTART;VALUE=DATE:${toIcalDate(ev.start_at, true)}`
        : `DTSTART:${toIcalDate(ev.start_at)}`;
      const dtEnd = ev.end_at
        ? ev.all_day
          ? `DTEND;VALUE=DATE:${toIcalDate(ev.end_at, true)}`
          : `DTEND:${toIcalDate(ev.end_at)}`
        : null;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtStamp}`);
      lines.push(dtStart);
      if (dtEnd) lines.push(dtEnd);
      lines.push(`SUMMARY:${escapeIcal(ev.title)}`);
      if (ev.description) lines.push(`DESCRIPTION:${escapeIcal(ev.description)}`);
      if (ev.location)    lines.push(`LOCATION:${escapeIcal(ev.location)}`);
      lines.push(`CATEGORIES:${escapeIcal(ev.event_type ?? "other")}`);
      lines.push(`STATUS:${ev.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="adala-calendar.ics"');
    res.send(lines.join("\r\n"));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /calendar/events/upcoming ─────────────────────────────────────────
router.get("/calendar/events/upcoming", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });
    await ensureTables();

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
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /calendar/events ──────────────────────────────────────────────────
router.post("/calendar/events", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });
    await ensureTables();

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
        INSERT INTO event_reminders
          (id, event_id, notify_before_minutes, notification_type, sent, email, created_at)
        VALUES
          (${remId}, ${id}, ${rem.minutesBefore ?? 60}, 'email',
           false, ${rem.email ?? null}, NOW())
      `);
    }

    const rows = await dbRows(sql`SELECT * FROM events WHERE id = ${id}`);
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /calendar/events/:id ───────────────────────────────────────────────
router.put("/calendar/events/:id", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });
    await ensureTables();

    const { id } = req.params;
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
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /calendar/events/:id ────────────────────────────────────────────
router.delete("/calendar/events/:id", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });
    await ensureTables();

    const { id } = req.params;
    const existing = await dbRows(sql`SELECT user_id FROM events WHERE id = ${id}`);
    if (!existing.length) return res.status(404).json({ error: "الحدث غير موجود" });
    if (existing[0].user_id !== authUserId) return res.status(403).json({ error: "غير مصرح" });

    await db.execute(sql`DELETE FROM event_reminders WHERE event_id = ${id}`);
    await db.execute(sql`DELETE FROM events WHERE id = ${id}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /calendar/reminders ─────────────────────────────────────────────────
router.get("/calendar/reminders", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });
    await ensureTables();

    const { eventId } = req.query as Record<string, string>;
    if (!eventId) return res.json([]);

    const evt = await dbRows(sql`SELECT user_id FROM events WHERE id = ${eventId}`);
    if (!evt.length || evt[0].user_id !== authUserId) return res.status(403).json({ error: "غير مصرح" });

    const rows = await dbRows(sql`
      SELECT * FROM event_reminders
      WHERE event_id = ${eventId}
      ORDER BY notify_before_minutes ASC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── /api/appointments aliases (task contract) ───────────────────────────────
router.get("/appointments",              async (req, res, next) => { (req as any).url = "/calendar/events";             return router.handle(req as any, res, next); });
router.post("/appointments",             async (req, res, next) => { (req as any).url = "/calendar/events";             return router.handle(req as any, res, next); });
router.put("/appointments/:id",          async (req, res, next) => { (req as any).url = `/calendar/events/${(req as any).params.id}`; return router.handle(req as any, res, next); });
router.delete("/appointments/:id",       async (req, res, next) => { (req as any).url = `/calendar/events/${(req as any).params.id}`; return router.handle(req as any, res, next); });

export default router;
