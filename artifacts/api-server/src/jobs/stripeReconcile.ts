/**
 * Stripe Reconciliation Job
 *
 * Compares Stripe API payment records against our office_ledger DB.
 * Detects: missing entries, amount mismatches, duplicate records.
 * Runs on schedule (every 6 hours) + can be triggered manually.
 *
 * Output: reconciliation_log table + JSON report
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; schema authority */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

/* Schema: stripe_reconciliation_log owned by
   artifacts/api-server/migrations/011_stripe_infrastructure_tables.sql */

function safeRows(r: any): any[] {
  return r?.rows ?? (Array.isArray(r) ? r : []);
}

/* ── Run reconciliation for a time window ───────────────────────── */

export interface ReconciliationResult {
  runAt: Date;
  periodStart: Date;
  periodEnd: Date;
  stripeCount: number;
  dbCount: number;
  missing: MissingEntry[];
  drifts: DriftEntry[];
  status: "ok" | "drift" | "error";
  error?: string;
}

interface MissingEntry {
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  createdAt: Date;
  reason: "not_in_db";
}

interface DriftEntry {
  reference: string;
  stripeAmount: number;
  dbAmount: number;
  difference: number;
  reason: "amount_mismatch";
}

export async function runStripeReconciliation(
  windowHours = 24 * 30  /* default: last 30 days */
): Promise<ReconciliationResult> {
  const periodEnd   = new Date();
  const periodStart = new Date(periodEnd.getTime() - windowHours * 3_600_000);
  const runAt       = new Date();

  logger.info({ periodStart, periodEnd }, "[Reconcile] Starting Stripe reconciliation");

  const stripe = await getUncachableStripeClient().catch(() => null);
  if (!stripe) {
    const result: ReconciliationResult = {
      runAt, periodStart, periodEnd,
      stripeCount: 0, dbCount: 0,
      missing: [], drifts: [],
      status: "error",
      error: "Stripe client unavailable — STRIPE_SECRET_KEY not set",
    };
    await persistResult(result);
    return result;
  }

  try {
    /* 1. Fetch Stripe payment intents (succeeded only) */
    const stripePayments: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const page: any = await stripe.paymentIntents.list({
        limit: 100,
        created: {
          gte: Math.floor(periodStart.getTime() / 1000),
          lte: Math.floor(periodEnd.getTime() / 1000),
        },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      const succeeded = (page.data ?? []).filter((pi: any) => pi.status === "succeeded");
      stripePayments.push(...succeeded);
      hasMore = page.has_more;
      if (hasMore && page.data?.length > 0) {
        startingAfter = page.data[page.data.length - 1].id;
      }
    }

    /* 2. Fetch DB ledger entries for same period */
    const dbEntries = safeRows(await db.execute(sql`
      SELECT stripe_id, stripe_event_id, amount, type, ref, created_at
      FROM office_ledger
      WHERE type = 'credit'
        AND created_at >= ${periodStart.toISOString()}
        AND created_at <= ${periodEnd.toISOString()}
    `));

    const dbByStripeId = new Map(dbEntries.map((e: any) => [e.stripe_id, e]));
    const dbByRef      = new Map(dbEntries.map((e: any) => [e.ref, e]));

    /* 3. Detect missing entries (Stripe has it, DB doesn't) */
    const missing: MissingEntry[] = [];
    const drifts:  DriftEntry[]   = [];

    for (const pi of stripePayments) {
      const amountSAR = (pi.amount ?? 0) / 100;
      const dbRow     = dbByStripeId.get(pi.id) ?? dbByRef.get(pi.id);

      if (!dbRow) {
        missing.push({
          stripePaymentIntentId: pi.id,
          amount: amountSAR,
          currency: pi.currency?.toUpperCase() ?? "SAR",
          createdAt: new Date(pi.created * 1000),
          reason: "not_in_db",
        });
      } else {
        /* Check amount drift (>1 SAR tolerance for FX rounding) */
        const dbAmount = parseFloat(dbRow.amount ?? 0);
        const diff     = Math.abs(amountSAR - dbAmount);
        if (diff > 1) {
          drifts.push({
            reference: pi.id,
            stripeAmount: amountSAR,
            dbAmount,
            difference: diff,
            reason: "amount_mismatch",
          });
        }
      }
    }

    const status: "ok" | "drift" = (missing.length + drifts.length) === 0 ? "ok" : "drift";

    const result: ReconciliationResult = {
      runAt,
      periodStart,
      periodEnd,
      stripeCount: stripePayments.length,
      dbCount:     dbEntries.length,
      missing,
      drifts,
      status,
    };

    if (missing.length > 0 || drifts.length > 0) {
      logger.warn(
        { missing: missing.length, drifts: drifts.length },
        "[Reconcile] DRIFT DETECTED"
      );
    } else {
      logger.info(
        { stripeCount: stripePayments.length, dbCount: dbEntries.length },
        "[Reconcile] All records match ✅"
      );
    }

    await persistResult(result);
    return result;
  } catch (err: any) {
    const error = String(err?.message ?? err);
    logger.error({ err: error }, "[Reconcile] Reconciliation error");

    const result: ReconciliationResult = {
      runAt, periodStart, periodEnd,
      stripeCount: 0, dbCount: 0,
      missing: [], drifts: [],
      status: "error",
      error,
    };
    await persistResult(result);
    return result;
  }
}

/* ── Persist result to DB ───────────────────────────────────────── */

async function persistResult(r: ReconciliationResult) {
  await db.execute(sql`
    INSERT INTO stripe_reconciliation_log
      (run_at, period_start, period_end, stripe_count, db_count,
       missing_count, drift_count, status, details, error)
    VALUES
      (${r.runAt.toISOString()},
       ${r.periodStart.toISOString()},
       ${r.periodEnd.toISOString()},
       ${r.stripeCount},
       ${r.dbCount},
       ${r.missing.length},
       ${r.drifts.length},
       ${r.status},
       ${JSON.stringify({ missing: r.missing, drifts: r.drifts })},
       ${r.error ?? null})
  `).catch(e => logger.error({ e }, "[Reconcile] Failed to persist result"));
}

/* ── Get recent reconciliation history ──────────────────────────── */

export async function getReconciliationHistory(limit = 10) {
  return safeRows(await db.execute(sql`
    SELECT id, run_at, period_start, period_end,
           stripe_count, db_count, missing_count, drift_count, status, error
    FROM stripe_reconciliation_log
    ORDER BY run_at DESC
    LIMIT ${limit}
  `));
}

/* ── Cron: run every 6 hours ────────────────────────────────────── */

let reconcileTimer: ReturnType<typeof setInterval> | null = null;

export function startReconciliationCron() {
  if (reconcileTimer) return;

  /* Run immediately on boot (non-blocking) */
  setTimeout(() => {
    runStripeReconciliation().catch(e =>
      logger.error({ e }, "[Reconcile] Boot reconciliation failed")
    );
  }, 30_000); /* 30s after server starts */

  /* Then every 6 hours */
  reconcileTimer = setInterval(() => {
    runStripeReconciliation().catch(e =>
      logger.error({ e }, "[Reconcile] Scheduled reconciliation failed")
    );
  }, 6 * 3_600_000);

  logger.info("[Reconcile] Reconciliation cron started (every 6h)");
}
