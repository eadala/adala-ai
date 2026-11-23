/**
 * Finance Listener — reacts to payment/invoice events
 *
 * Stage 17 — never invent "default" / platform / trial_* ownership.
 * Side-effects run only when event.officeId is a canonical Office UUID.
 * Invoice mutations are always scoped by that office UUID.
 */
import { eventBus, StoredEvent } from "../eventBus";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runOwnedFinanceEffect } from "../../lib/financeOwnership";

export {
  resolveFinanceOfficeId,
  resolveFinanceEventOfficeId,
  logFinanceSkip,
  runOwnedFinanceEffect,
} from "../../lib/financeOwnership";

async function updateWalletStats(officeId: string, amount: unknown): Promise<void> {
  if (amount == null || amount === "") return;
  await db.execute(sql`
    INSERT INTO office_wallet_snapshots (office_id, last_payment_amount, last_payment_at, updated_at)
    VALUES (${officeId}, ${amount}, NOW(), NOW())
    ON CONFLICT (office_id) DO UPDATE
      SET last_payment_amount = EXCLUDED.last_payment_amount,
          last_payment_at     = NOW(),
          updated_at          = NOW()
  `).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[FinanceListener] wallet_upsert_failed", {
      officeId,
      message,
    });
  });
}

async function markInvoicePaidForOffice(
  officeId: string,
  invoiceId: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE client_invoices
    SET status      = 'paid',
        amount_paid = total,
        paid_at     = NOW(),
        updated_at  = NOW()
    WHERE id = ${invoiceId}::uuid
      AND office_id = ${officeId}
      AND status != 'paid'
  `).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[FinanceListener] invoice_mark_paid_failed", {
      officeId,
      invoiceId,
      message,
    });
  });

  await db.execute(sql`
    INSERT INTO invoice_payments (invoice_id, office_id, amount, method, notes)
    SELECT id, office_id, total, 'stripe', 'Stripe Payment Success'
    FROM client_invoices
    WHERE id = ${invoiceId}::uuid
      AND office_id = ${officeId}
      AND NOT EXISTS (
        SELECT 1 FROM invoice_payments ip
        WHERE ip.invoice_id = ${invoiceId}::uuid AND ip.method = 'stripe'
      )
  `).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[FinanceListener] invoice_payment_insert_failed", {
      officeId,
      invoiceId,
      message,
    });
  });
}

export function registerFinanceListeners() {
  /* PAYMENT_SUCCESS → wallet snapshot + tenant-scoped invoice link */
  eventBus.on("PAYMENT_SUCCESS", async (event: StoredEvent) => {
    const { amount, invoiceId, clientName } = event.data ?? {};
    console.log(`[Finance] PAYMENT_SUCCESS: ${amount} SAR from ${clientName ?? "?"}`);

    await runOwnedFinanceEffect({
      event,
      eventType: "PAYMENT_SUCCESS",
      effectFn: async (officeId) => {
        await updateWalletStats(officeId, amount);
        if (invoiceId) {
          await markInvoicePaidForOffice(officeId, String(invoiceId));
        }
      },
    });
  });

  /* PAYMENT_FAILED → log only (no tenant invent / no write) */
  eventBus.on("PAYMENT_FAILED", async (event: StoredEvent) => {
    const { amount, clientName, reason } = event.data ?? {};
    console.warn(`[Finance] PAYMENT_FAILED: ${amount} SAR from ${clientName ?? "?"} — ${reason ?? "unknown"}`);
  });

  /* INVOICE_PAID → revenue tracking (UUID office only) */
  eventBus.on("INVOICE_PAID", async (event: StoredEvent) => {
    const { total, invoiceNumber, clientName } = event.data ?? {};
    console.log(`[Finance] INVOICE_PAID: ${invoiceNumber} — ${total} SAR — ${clientName ?? "?"}`);

    await runOwnedFinanceEffect({
      event,
      eventType: "INVOICE_PAID",
      effectFn: async (officeId) => {
        await updateWalletStats(officeId, total);
      },
    });
  });

  /* PAYMENT_SETTLED → log only */
  eventBus.on("PAYMENT_SETTLED", async (event: StoredEvent) => {
    const { amount, settlementRef } = event.data ?? {};
    console.log(`[Finance] PAYMENT_SETTLED: ${amount} SAR — ref: ${settlementRef ?? "?"}`);
  });
}
