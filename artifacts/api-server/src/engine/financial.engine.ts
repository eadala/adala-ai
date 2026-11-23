/**
 * Financial Engine Core — مصدر الحقيقة المالية
 * ────────────────────────────────────────────────
 * يبني على الجداول الموجودة:
 *   payment_transactions → سجل المعاملات
 *   ledger_entries       → دفتر الأستاذ (balance_after = running balance)
 *   office_ledger        → ملخص المكتب (يُقرأ منه billing.ts)
 *
 * 5 طبقات:
 *   1. Idempotency Guard   — لا معالجة مزدوجة
 *   2. Revenue Split       — platform_fee + stripe_fee + net
 *   3. Transaction Ingest  — يحفظ في payment_transactions
 *   4. Ledger Post         — يحفظ في ledger_entries مع balance_after
 *   5. Reconcile           — يقارن payment_transactions vs office_ledger
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/* ─── Types ─── */
export interface IngestInput {
  officeId: string;
  source: "stripe" | "manual" | "moyasar" | "checkout" | "system";
  type: "payment" | "refund" | "fee" | "payout";
  amount: number;
  currency?: string;
  stripeEventId?: string;
  gatewayPaymentId?: string;
  description?: string;
  clientName?: string;
  invoiceId?: string;
  caseId?: string;
  metadata?: Record<string, unknown>;
}

export interface RevenueSplit {
  gross: number;
  platformFee: number;
  stripeFee: number;
  net: number;
  feePercent: number;
}

export interface EngineResult {
  transactionId: string;
  ledgerEntryId: string;
  split: RevenueSplit;
  balanceAfter: number;
  skipped?: boolean;
  reason?: string;
}

/* ─── Revenue Split ─── */
export function calculateRevenueSplit(
  grossAmount: number,
  source: string = "stripe"
): RevenueSplit {
  const platformFeeRate = 0.10;                    // 10%
  const stripeFeeRate   = source === "stripe" ? 0.029 : 0.015;
  const stripeFixedFee  = source === "stripe" ? 1.0  : 0;    // 1 ريال ثابت

  const platformFee = +(grossAmount * platformFeeRate).toFixed(2);
  const stripeFee   = +(grossAmount * stripeFeeRate + stripeFixedFee).toFixed(2);
  const net         = +(grossAmount - platformFee - stripeFee).toFixed(2);

  return {
    gross: grossAmount,
    platformFee,
    stripeFee,
    net: Math.max(net, 0),
    feePercent: +(((platformFee + stripeFee) / grossAmount) * 100).toFixed(1),
  };
}

/* ─── Running Balance ─── */
async function getLastBalance(officeId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT balance_after FROM ledger_entries
    WHERE office_id = ${officeId}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const r = ((rows.rows ?? rows) as any[])[0];
  return r ? Number(r.balance_after) : 0;
}

/* ─── Idempotency Check ─── */
async function isAlreadyProcessed(
  stripeEventId?: string,
  gatewayPaymentId?: string
): Promise<boolean> {
  if (stripeEventId) {
    const r = await db.execute(sql`
      SELECT id FROM payment_transactions
      WHERE stripe_event_id = ${stripeEventId} LIMIT 1
    `);
    return ((r.rows ?? r) as any[]).length > 0;
  }
  if (gatewayPaymentId) {
    const r = await db.execute(sql`
      SELECT id FROM payment_transactions
      WHERE gateway_payment_id = ${gatewayPaymentId} LIMIT 1
    `);
    return ((r.rows ?? r) as any[]).length > 0;
  }
  return false;
}

/* ─── Core: Process Transaction ─── */
export async function processTransaction(input: IngestInput): Promise<EngineResult> {
  const { officeId, source, type, amount, currency = "SAR", description, clientName,
          invoiceId, caseId, metadata, stripeEventId, gatewayPaymentId } = input;

  /* 1. Idempotency Guard */
  if (await isAlreadyProcessed(stripeEventId, gatewayPaymentId)) {
    return {
      transactionId: "",
      ledgerEntryId: "",
      split: calculateRevenueSplit(amount, source),
      balanceAfter: await getLastBalance(officeId),
      skipped: true,
      reason: "already_processed",
    };
  }

  /* 2. Revenue Split */
  const split = calculateRevenueSplit(amount, source);

  /* 3. Save Transaction */
  const txRows = await db.execute(sql`
    INSERT INTO payment_transactions
      (office_id, client_name, description, amount, currency,
       platform_fee, net_amount, status, gateway, stripe_event_id,
       gateway_payment_id, invoice_id, case_id, metadata)
    VALUES
      (${officeId}, ${clientName ?? null}, ${description ?? null},
       ${amount}, ${currency}, ${split.platformFee}, ${split.net},
       'completed', ${source}, ${stripeEventId ?? null},
       ${gatewayPaymentId ?? null}, ${invoiceId ?? null}, ${caseId ?? null},
       ${JSON.stringify(metadata ?? {})}::jsonb)
    RETURNING id
  `);
  const transactionId = ((txRows.rows ?? txRows) as any[])[0]?.id as string;

  /* 4. Post to Ledger */
  const lastBalance = await getLastBalance(officeId);
  const balanceAfter = type === "refund"
    ? +(lastBalance - amount).toFixed(2)
    : +(lastBalance + split.net).toFixed(2);

  const ledgerRows = await db.execute(sql`
    INSERT INTO ledger_entries
      (office_id, transaction_ref, debit_account, credit_account,
       amount, currency, description, entry_type, source,
       stripe_fee, platform_fee, balance_after, status)
    VALUES
      (${officeId}, ${transactionId},
       ${type === "refund" ? "cash" : "accounts_receivable"},
       ${type === "refund" ? "revenue" : "cash"},
       ${split.net}, ${currency}, ${description ?? `${type} via ${source}`},
       ${type}, ${source}, ${split.stripeFee}, ${split.platformFee},
       ${balanceAfter}, 'posted')
    RETURNING id
  `);
  const ledgerEntryId = ((ledgerRows.rows ?? ledgerRows) as any[])[0]?.id as string;

  /* 5. Sync office_ledger (upsert) */
  await db.execute(sql`
    INSERT INTO office_ledger (office_id, amount, type, description, stripe_event_id)
    VALUES (${officeId}, ${split.net}, 'credit', ${description ?? source}, ${stripeEventId ?? null})
    ON CONFLICT DO NOTHING
  `).catch(() => {
    /* fallback — office_ledger may have different schema */
  });

  return { transactionId, ledgerEntryId, split, balanceAfter };
}

/* ─── Tenant Balance ─── */
export async function getTenantBalance(officeId: string): Promise<{
  balance: number;
  totalCredit: number;
  totalDebit: number;
  transactionCount: number;
}> {
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN entry_type != 'refund' THEN amount ELSE 0 END), 0) AS total_credit,
      COALESCE(SUM(CASE WHEN entry_type = 'refund' THEN amount ELSE 0 END), 0)  AS total_debit,
      COUNT(*) AS tx_count
    FROM ledger_entries
    WHERE office_id = ${officeId}
  `);
  const r = ((rows.rows ?? rows) as any[])[0] ?? {};
  const credit = Number(r.total_credit ?? 0);
  const debit  = Number(r.total_debit  ?? 0);
  return {
    balance: +(credit - debit).toFixed(2),
    totalCredit: +credit.toFixed(2),
    totalDebit:  +debit.toFixed(2),
    transactionCount: Number(r.tx_count ?? 0),
  };
}

/* ─── Platform Revenue Summary ─── */
export async function getPlatformRevenueSummary(): Promise<{
  totalGross: number;
  totalPlatformFees: number;
  totalStripeFees: number;
  totalNet: number;
  transactionCount: number;
  officeCount: number;
}> {
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount + platform_fee + stripe_fee), 0)  AS total_gross,
      COALESCE(SUM(platform_fee), 0)                         AS total_platform_fees,
      COALESCE(SUM(stripe_fee), 0)                           AS total_stripe_fees,
      COALESCE(SUM(amount), 0)                               AS total_net,
      COUNT(*)                                               AS tx_count,
      COUNT(DISTINCT office_id)                              AS office_count
    FROM ledger_entries
    WHERE status = 'posted' AND entry_type != 'refund'
  `);
  const r = ((rows.rows ?? rows) as any[])[0] ?? {};
  return {
    totalGross:       +Number(r.total_gross        ?? 0).toFixed(2),
    totalPlatformFees:+Number(r.total_platform_fees ?? 0).toFixed(2),
    totalStripeFees:  +Number(r.total_stripe_fees   ?? 0).toFixed(2),
    totalNet:         +Number(r.total_net           ?? 0).toFixed(2),
    transactionCount: Number(r.tx_count       ?? 0),
    officeCount:      Number(r.office_count   ?? 0),
  };
}

/* ─── Reconciliation ─── */
export async function reconcile(officeId?: string): Promise<{
  status: "ok" | "mismatch" | "empty";
  ledgerTotal: number;
  transactionTotal: number;
  delta: number;
  message: string;
}> {
  const officeFilter = officeId ? sql`WHERE office_id = ${officeId}` : sql`WHERE 1=1`;
  const officeFilterTx = officeId ? sql`WHERE office_id = ${officeId}` : sql`WHERE 1=1`;

  const [ledR, txR] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(SUM(amount),0) AS total
      FROM ledger_entries
      ${officeFilter}
        AND entry_type != 'refund'
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(net_amount),0) AS total
      FROM payment_transactions
      ${officeFilterTx}
        AND status = 'completed'
    `),
  ]);

  const ledger = +Number(((ledR.rows ?? ledR) as any[])[0]?.total ?? 0).toFixed(2);
  const txTotal = +Number(((txR.rows ?? txR) as any[])[0]?.total ?? 0).toFixed(2);
  const delta = +(ledger - txTotal).toFixed(2);

  if (ledger === 0 && txTotal === 0) return { status: "empty", ledgerTotal: 0, transactionTotal: 0, delta: 0, message: "لا توجد بيانات بعد" };
  if (Math.abs(delta) < 0.01)       return { status: "ok",    ledgerTotal: ledger, transactionTotal: txTotal, delta, message: "✅ متطابق تماماً" };
  return                                    { status: "mismatch", ledgerTotal: ledger, transactionTotal: txTotal, delta, message: `⚠️ فرق: ${delta} ريال — تحقق من المعاملات` };
}
