import { requireAuth } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_events (
      id SERIAL PRIMARY KEY,
      office_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      body TEXT,
      payload JSONB DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ai_events_office_status_idx
      ON ai_events(office_id, status, created_at DESC)
  `);
}
ensureTables().catch(() => {});

const lastScanAt: Record<string, number> = {};
const SCAN_COOLDOWN_MS = 30 * 60 * 1000;

async function insertIfNew(officeId: string, type: string, severity: string, title: string, body: string, payload: object) {
  await db.execute(sql`
    INSERT INTO ai_events (office_id, type, severity, title, body, payload)
    SELECT ${officeId}, ${type}, ${severity}, ${title}, ${body}, ${JSON.stringify(payload)}::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_events
      WHERE office_id = ${officeId}
        AND type = ${type}
        AND status = 'pending'
        AND created_at > NOW() - INTERVAL '24 hours'
    )
  `);
}

function sqlRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}

async function runAutonomousScan(officeId: string) {
  const now = Date.now();
  if (lastScanAt[officeId] && now - lastScanAt[officeId] < SCAN_COOLDOWN_MS) return;
  lastScanAt[officeId] = now;

  /* 1. Overdue invoices (> 7 days unpaid) */
  try {
    const res = await db.execute(sql`
      SELECT COUNT(*) as cnt
      FROM client_invoices
      WHERE office_id = ${officeId}
        AND status IN ('sent', 'draft')
        AND due_date < NOW() - INTERVAL '7 days'
    `);
    const cnt = Number(sqlRows(res)[0]?.cnt ?? 0);
    if (cnt > 0) {
      await insertIfNew(
        officeId, "OVERDUE_INVOICES", "high",
        `${cnt} فاتورة متأخرة عن السداد`,
        "فواتير تجاوزت موعد استحقاقها بأكثر من 7 أيام — يُنصح بمتابعة عاجلة",
        { count: cnt }
      );
    }
  } catch {}

  /* 2. Court sessions in next 72h */
  try {
    const res = await db.execute(sql`
      SELECT COUNT(*) as cnt
      FROM case_sessions cs
      JOIN cases c ON c.id = cs.case_id
      WHERE c.office_id = ${officeId}
        AND cs.session_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
    `);
    const cnt = Number(sqlRows(res)[0]?.cnt ?? 0);
    if (cnt > 0) {
      await insertIfNew(
        officeId, "UPCOMING_SESSIONS", "critical",
        `${cnt} جلسة قضائية خلال 72 ساعة`,
        "تأكد من اكتمال الاستعداد لجميع الجلسات القادمة وتوفر المستندات المطلوبة",
        { count: cnt }
      );
    }
  } catch {}

  /* 3. Cases without updates for 30+ days */
  try {
    const res = await db.execute(sql`
      SELECT COUNT(*) as cnt
      FROM cases
      WHERE office_id = ${officeId}
        AND status = 'in_progress'
        AND updated_at < NOW() - INTERVAL '30 days'
    `);
    const cnt = Number(sqlRows(res)[0]?.cnt ?? 0);
    if (cnt > 0) {
      await insertIfNew(
        officeId, "STALE_CASES", "info",
        `${cnt} قضية بدون تحديث منذ 30 يوماً`,
        "قضايا نشطة لم يطرأ عليها أي تعديل منذ أكثر من شهر — قد تحتاج مراجعة",
        { count: cnt }
      );
    }
  } catch {}

  /* 4. High outstanding balance */
  try {
    const res = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM client_invoices
      WHERE office_id = ${officeId}
        AND status IN ('sent', 'draft')
        AND due_date < NOW()
    `);
    const total = Number(sqlRows(res)[0]?.total ?? 0);
    if (total > 50000) {
      await insertIfNew(
        officeId, "HIGH_OUTSTANDING", "high",
        `مستحقات غير محصّلة تتجاوز ${(total / 100).toLocaleString("ar-SA")} ر.س`,
        "رصيد مستحقات مرتفع — يُوصى بجدولة حملة تحصيل",
        { total }
      );
    }
  } catch {}

  /* Cleanup: remove dismissed events older than 7 days */
  try {
    await db.execute(sql`
      DELETE FROM ai_events
      WHERE office_id = ${officeId}
        AND status = 'dismissed'
        AND created_at < NOW() - INTERVAL '7 days'
    `);
  } catch {}
}

/* ── GET /api/ai-events ─────────────────────────── */
router.get("/ai-events", requireAuth, async (req, res) => {
  const officeId = (req as any).officeId as string;
  if (!officeId) { res.json({ events: [] }); return; }

  runAutonomousScan(officeId).catch(() => {});

  try {
    const evts = await db.execute(sql`
      SELECT id, type, severity, title, body, payload, created_at
      FROM ai_events
      WHERE office_id = ${officeId}
        AND status = 'pending'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high'     THEN 2
          ELSE 3
        END,
        created_at DESC
      LIMIT 10
    `);
    res.json({ events: sqlRows(evts) });
  } catch (err: any) {
    res.status(500).json({ error: err.message, events: [] });
  }
});

/* ── POST /api/ai-events/:id/dismiss ─────────────── */
router.post("/ai-events/:id/dismiss", requireAuth, async (req, res) => {
  const officeId = (req as any).officeId as string;
  const id = parseInt(String(req.params.id));
  if (!officeId || isNaN(id)) { res.status(400).json({ error: "invalid" }); return; }
  try {
    await db.execute(sql`
      UPDATE ai_events SET status = 'dismissed'
      WHERE id = ${id} AND office_id = ${officeId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/ai-events/scan ─────────────────────── */
router.post("/ai-events/scan", requireAuth, async (req, res) => {
  const officeId = (req as any).officeId as string;
  if (!officeId) { res.status(401).json({ error: "unauthorized" }); return; }
  delete lastScanAt[officeId];
  try {
    await runAutonomousScan(officeId);
    res.json({ ok: true, scanned: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
