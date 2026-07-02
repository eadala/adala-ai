/**
 * Stripe Event Buffer — Production-grade event processing layer
 *
 * Flow:
 *   1. Webhook arrives → verify signature → idempotency check → save to stripe_events
 *   2. Process event synchronously (with retry logic)
 *   3. On success → status = 'done'
 *   4. On error   → retry up to MAX_RETRIES with exponential backoff
 *   5. After MAX_RETRIES failures → move to stripe_dead_letters (DLQ)
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1_000; // 1s, 2s, 4s

/* ── Ensure tables exist at module load ─────────────────────────── */
export async function ensureStripeBufferTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS stripe_events (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stripe_event_id  TEXT UNIQUE NOT NULL,
      type             TEXT NOT NULL,
      payload          JSONB NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','processing','done','failed')),
      retry_count      INTEGER NOT NULL DEFAULT 0,
      last_error       TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at     TIMESTAMPTZ
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_stripe_events_status
      ON stripe_events(status) WHERE status IN ('pending','failed')
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_stripe_events_created
      ON stripe_events(created_at DESC)
  `).catch(() => {});

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS stripe_dead_letters (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stripe_event_id  TEXT NOT NULL,
      type             TEXT NOT NULL,
      payload          JSONB NOT NULL,
      error            TEXT NOT NULL,
      retry_count      INTEGER NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_stripe_dlq_created
      ON stripe_dead_letters(created_at DESC)
  `).catch(() => {});
}

/* ── Internal helpers ───────────────────────────────────────────── */

function safeRows(r: any): any[] {
  return r?.rows ?? (Array.isArray(r) ? r : []);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function moveToDLQ(stripeEventId: string, type: string, payload: any, error: string, retryCount: number) {
  await db.execute(sql`
    INSERT INTO stripe_dead_letters (stripe_event_id, type, payload, error, retry_count)
    VALUES (${stripeEventId}, ${type}, ${JSON.stringify(payload)}, ${error}, ${retryCount})
  `).catch((e: unknown) => logger.error({ e }, "[StripeBuffer] DLQ insert failed"));

  await db.execute(sql`
    UPDATE stripe_events
    SET status = 'failed', last_error = ${error}, processed_at = NOW()
    WHERE stripe_event_id = ${stripeEventId}
  `).catch(() => {});

  logger.error({ stripeEventId, type, retryCount }, "[StripeBuffer] Event moved to DLQ");
}

/* ── Main entry: buffer → process ──────────────────────────────── */

export async function bufferAndProcess(
  rawBody: Buffer,
  signature: string,
  processEvent: (event: any) => Promise<void>
): Promise<void> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured — rejecting unverified webhook");
  }

  /* 1. Verify signature FIRST — security gate */
  const stripe = await getUncachableStripeClient();
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new Error("Webhook signature verification failed");
  }

  const eventId   = event.id   as string;
  const eventType = event.type as string;

  /* 2. Idempotency — check if already processed */
  const existing = safeRows(await db.execute(sql`
    SELECT id, status FROM stripe_events WHERE stripe_event_id = ${eventId} LIMIT 1
  `))[0];

  if (existing?.status === 'done') {
    logger.info({ eventId, eventType }, "[StripeBuffer] Duplicate event — already done, skipping");
    return;
  }

  if (existing?.status === 'processing') {
    logger.warn({ eventId, eventType }, "[StripeBuffer] Event still processing — skipping concurrent duplicate");
    return;
  }

  /* 3. Save event to buffer (INSERT OR ignore if somehow exists) */
  await db.execute(sql`
    INSERT INTO stripe_events (stripe_event_id, type, payload, status)
    VALUES (${eventId}, ${eventType}, ${JSON.stringify(event)}, 'processing')
    ON CONFLICT (stripe_event_id) DO UPDATE
      SET status = 'processing', retry_count = stripe_events.retry_count + 1
  `).catch((e: unknown) => logger.error({ e }, "[StripeBuffer] Failed to write event buffer"));

  /* 4. Process with retry + exponential backoff */
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await processEvent(event);

      /* 5. Mark done */
      await db.execute(sql`
        UPDATE stripe_events
        SET status = 'done', processed_at = NOW()
        WHERE stripe_event_id = ${eventId}
      `).catch(() => {});

      logger.info({ eventId, eventType, attempt }, "[StripeBuffer] Event processed successfully");
      return;
    } catch (err: any) {
      lastError = String(err?.message ?? err);
      logger.warn({ eventId, eventType, attempt, err: lastError }, `[StripeBuffer] Attempt ${attempt}/${MAX_RETRIES} failed`);

      await db.execute(sql`
        UPDATE stripe_events
        SET retry_count = ${attempt}, last_error = ${lastError}
        WHERE stripe_event_id = ${eventId}
      `).catch(() => {});

      if (attempt < MAX_RETRIES) {
        /* Exponential backoff: 1s, 2s, 4s */
        await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  /* 6. All retries exhausted → Dead Letter Queue */
  await moveToDLQ(eventId, eventType, event, lastError, MAX_RETRIES);
  throw new Error(`[StripeBuffer] Event ${eventId} failed after ${MAX_RETRIES} attempts — moved to DLQ`);
}

/* ── Retry a specific DLQ entry ─────────────────────────────────── */

export async function retryDLQEntry(
  dlqId: string,
  processEvent: (event: any) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  const row = safeRows(await db.execute(sql`
    SELECT * FROM stripe_dead_letters WHERE id = ${dlqId} LIMIT 1
  `))[0];

  if (!row) return { success: false, error: "DLQ entry not found" };

  try {
    await processEvent(row.payload);

    /* Remove from DLQ + mark stripe_events done */
    await db.execute(sql`DELETE FROM stripe_dead_letters WHERE id = ${dlqId}`).catch(() => {});
    await db.execute(sql`
      UPDATE stripe_events SET status = 'done', processed_at = NOW()
      WHERE stripe_event_id = ${row.stripe_event_id}
    `).catch(() => {});

    logger.info({ dlqId, eventId: row.stripe_event_id }, "[StripeBuffer] DLQ retry succeeded");
    return { success: true };
  } catch (err: any) {
    const error = String(err?.message ?? err);
    await db.execute(sql`
      UPDATE stripe_dead_letters
      SET retry_count = retry_count + 1, error = ${error}
      WHERE id = ${dlqId}
    `).catch(() => {});
    return { success: false, error };
  }
}

/* ── Stats for admin dashboard ──────────────────────────────────── */

export async function getStripeBufferStats() {
  const statusCounts = safeRows(await db.execute(sql`
    SELECT status, COUNT(*)::int AS count FROM stripe_events GROUP BY status
  `));

  const dlqCount = safeRows(await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM stripe_dead_letters
  `))[0]?.count ?? 0;

  const recentEvents = safeRows(await db.execute(sql`
    SELECT stripe_event_id, type, status, retry_count, last_error, created_at, processed_at
    FROM stripe_events
    ORDER BY created_at DESC
    LIMIT 20
  `));

  const recentDLQ = safeRows(await db.execute(sql`
    SELECT id, stripe_event_id, type, error, retry_count, created_at
    FROM stripe_dead_letters
    ORDER BY created_at DESC
    LIMIT 20
  `));

  return { statusCounts, dlqCount, recentEvents, recentDLQ };
}
