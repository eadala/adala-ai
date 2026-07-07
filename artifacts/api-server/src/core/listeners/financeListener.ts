/**
 * Finance Listener — reacts to payment/invoice events
 */
import { eventBus, StoredEvent } from "../eventBus";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { isRealOfficeTenantId } from "../tenantContext";

async function updateWalletStats(data: Record<string, any>) {
  try {
    const officeId = data.officeId as string | undefined;
    if (!data.amount || !isRealOfficeTenantId(officeId)) return;
    await db.execute(sql`
        INSERT INTO office_wallet_snapshots (office_id, last_payment_amount, last_payment_at, updated_at)
        VALUES (${officeId}, ${data.amount}, NOW(), NOW())
        ON CONFLICT (office_id) DO UPDATE
          SET last_payment_amount = EXCLUDED.last_payment_amount,
              last_payment_at     = NOW(),
              updated_at          = NOW()
      `).catch(() => {});
  } catch {}
}

export function registerFinanceListeners() {
  /* PAYMENT_SUCCESS → update wallet snapshot + auto-link invoice if provided */
  eventBus.on("PAYMENT_SUCCESS", async (event: StoredEvent) => {
    const { amount, invoiceId, officeId, clientName } = event.data;
    console.log(`[Finance] PAYMENT_SUCCESS: ${amount} SAR from ${clientName ?? "?"}`);

    await updateWalletStats({ amount, officeId });

    /* If linked to invoice, mark as paid and sync amount_paid */
    if (invoiceId) {
      await db.execute(sql`
        UPDATE client_invoices
        SET status      = 'paid',
            amount_paid = total,
            paid_at     = NOW(),
            updated_at  = NOW()
        WHERE id = ${invoiceId}::uuid AND status != 'paid'
      `).catch(() => {});

      /* إنشاء سجل دفعة إذا لم يكن موجوداً */
      await db.execute(sql`
        INSERT INTO invoice_payments (invoice_id, office_id, amount, method, notes)
        SELECT id, office_id, total, 'stripe', 'Stripe Payment Success'
        FROM client_invoices
        WHERE id = ${invoiceId}::uuid
          AND NOT EXISTS (
            SELECT 1 FROM invoice_payments ip
            WHERE ip.invoice_id = ${invoiceId}::uuid AND ip.method = 'stripe'
          )
      `).catch(() => {});
    }
  });

  /* PAYMENT_FAILED → log and flag */
  eventBus.on("PAYMENT_FAILED", async (event: StoredEvent) => {
    const { amount, clientName, reason } = event.data;
    console.warn(`[Finance] PAYMENT_FAILED: ${amount} SAR from ${clientName ?? "?"} — ${reason ?? "unknown"}`);
  });

  /* INVOICE_PAID → revenue tracking */
  eventBus.on("INVOICE_PAID", async (event: StoredEvent) => {
    const { total, invoiceNumber, clientName } = event.data;
    console.log(`[Finance] INVOICE_PAID: ${invoiceNumber} — ${total} SAR — ${clientName ?? "?"}`);
    await updateWalletStats({ amount: total, officeId: event.officeId });
  });

  /* PAYMENT_SETTLED → record settlement */
  eventBus.on("PAYMENT_SETTLED", async (event: StoredEvent) => {
    const { amount, settlementRef } = event.data;
    console.log(`[Finance] PAYMENT_SETTLED: ${amount} SAR — ref: ${settlementRef ?? "?"}`);
  });
}
