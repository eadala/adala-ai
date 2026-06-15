/**
 * Stripe Admin Routes — DLQ management, reconciliation, event buffer dashboard
 *
 * All routes require super-admin access (isSuperAdmin middleware).
 *
 * GET  /stripe-admin/stats           — Buffer stats + DLQ count
 * GET  /stripe-admin/events          — Recent stripe_events log
 * GET  /stripe-admin/dlq             — Dead letter queue entries
 * POST /stripe-admin/dlq/:id/retry   — Retry a DLQ entry
 * DELETE /stripe-admin/dlq/:id       — Purge a DLQ entry
 * GET  /stripe-admin/reconciliation  — Reconciliation history
 * POST /stripe-admin/reconciliation/run — Trigger manual reconciliation
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import {
  getStripeBufferStats,
  retryDLQEntry,
} from "../services/stripeEventBuffer";
import {
  runStripeReconciliation,
  getReconciliationHistory,
} from "../jobs/stripeReconcile";
import { WebhookHandlers } from "../webhookHandlers";

const router = Router();

function safeRows(r: any): any[] {
  return r?.rows ?? (Array.isArray(r) ? r : []);
}

function isSuperAdmin(req: any): boolean {
  const meta = req.auth?.sessionClaims?.publicMetadata as any;
  if (meta?.role === "super_admin") return true;
  const allowedEmails = (process.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  const email = req.auth?.sessionClaims?.email as string ?? "";
  return allowedEmails.includes(email);
}

function adminOnly(req: any, res: any, next: any) {
  requireAuth(req, res, () => {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    next();
  });
}

/* ── GET /stripe-admin/stats ─────────────────────────────────────── */
router.get("/stripe-admin/stats", adminOnly, async (_req, res) => {
  try {
    const stats = await getStripeBufferStats();
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /stripe-admin/events ────────────────────────────────────── */
router.get("/stripe-admin/events", adminOnly, async (req, res) => {
  try {
    const { status, limit = "50" } = req.query as any;
    const rows = safeRows(await db.execute(status ? sql`
      SELECT stripe_event_id, type, status, retry_count, last_error, created_at, processed_at
      FROM stripe_events
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
    ` : sql`
      SELECT stripe_event_id, type, status, retry_count, last_error, created_at, processed_at
      FROM stripe_events
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
    `));
    res.json({ events: rows, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /stripe-admin/dlq ───────────────────────────────────────── */
router.get("/stripe-admin/dlq", adminOnly, async (req, res) => {
  try {
    const { limit = "50" } = req.query as any;
    const rows = safeRows(await db.execute(sql`
      SELECT id, stripe_event_id, type, error, retry_count, created_at
      FROM stripe_dead_letters
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
    `));
    res.json({ entries: rows, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /stripe-admin/dlq/:id/retry ───────────────────────────── */
router.post("/stripe-admin/dlq/:id/retry", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await retryDLQEntry(id, async (event: any) => {
      await WebhookHandlers.dispatchEvent(event);
    });

    if (result.success) {
      res.json({ success: true, message: "Event reprocessed successfully" });
    } else {
      res.status(422).json({ success: false, error: result.error });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── DELETE /stripe-admin/dlq/:id ───────────────────────────────── */
router.delete("/stripe-admin/dlq/:id", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM stripe_dead_letters WHERE id = ${id}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── DELETE /stripe-admin/dlq (purge all) ───────────────────────── */
router.delete("/stripe-admin/dlq", adminOnly, async (_req, res) => {
  try {
    const count = safeRows(await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM stripe_dead_letters
    `))[0]?.count ?? 0;
    await db.execute(sql`DELETE FROM stripe_dead_letters`);
    res.json({ success: true, purged: count });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /stripe-admin/reconciliation ───────────────────────────── */
router.get("/stripe-admin/reconciliation", adminOnly, async (req, res) => {
  try {
    const { limit = "20" } = req.query as any;
    const history = await getReconciliationHistory(parseInt(limit));
    res.json({ history });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /stripe-admin/reconciliation/run ──────────────────────── */
router.post("/stripe-admin/reconciliation/run", adminOnly, async (req, res) => {
  try {
    const { windowHours = 720 } = req.body; /* default 30 days */
    const result = await runStripeReconciliation(windowHours);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
