import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import type {
  CreateCheckoutSessionInput,
  PaymentProviderId,
  PaymentStatusValue,
  PaymentTransactionRecord,
} from "./types";

export function generateTransactionReference(prefix = "ADALA"): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Runtime schema alignment — no production migration files */
export async function ensurePaymentGatewaySchema(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS customer_id TEXT,
      ADD COLUMN IF NOT EXISTS payment_provider TEXT,
      ADD COLUMN IF NOT EXISTS payment_status TEXT,
      ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
      ADD COLUMN IF NOT EXISTS webhook_event_id TEXT
  `).catch(() => {});
}

export interface CreateTransactionInput extends CreateCheckoutSessionInput {
  transactionReference: string;
  provider: PaymentProviderId;
  status?: PaymentStatusValue;
  platformFee?: number;
  netAmount?: number;
  gatewayPaymentId?: string;
}

export async function createPaymentTransaction(
  input: CreateTransactionInput
): Promise<PaymentTransactionRecord> {
  await ensurePaymentGatewaySchema();

  const platformFee = input.platformFee ?? 0;
  const netAmount = input.netAmount ?? input.amount - platformFee;
  const status = input.status ?? "pending";

  const result = await db.execute(sql`
    INSERT INTO payment_transactions (
      office_id, client_name, description, amount, platform_fee, net_amount,
      status, payment_method, invoice_id, case_id, gateway, gateway_payment_id,
      subscription_id, customer_id, payment_provider, payment_status,
      transaction_reference
    ) VALUES (
      ${input.tenantId},
      ${input.clientName ?? null},
      ${input.description ?? "دفع خدمة"},
      ${input.amount},
      ${platformFee},
      ${netAmount},
      ${status},
      ${input.provider},
      ${input.invoiceId ?? null},
      ${null},
      ${input.provider},
      ${input.gatewayPaymentId ?? input.transactionReference},
      ${input.subscriptionId ?? null},
      ${input.customerId ?? null},
      ${input.provider},
      ${status},
      ${input.transactionReference}
    )
    RETURNING
      id, office_id, invoice_id, subscription_id, customer_id,
      payment_provider, payment_status, transaction_reference,
      gateway_payment_id, webhook_event_id, amount, description
  `) as { rows?: Record<string, unknown>[] };

  const row = (Array.isArray(result) ? result[0] : result?.rows?.[0]) as Record<string, unknown>;
  return mapRow(row);
}

export async function updatePaymentByReference(opts: {
  transactionReference: string;
  gatewayPaymentId?: string;
  paymentStatus: PaymentStatusValue;
  webhookEventId?: string;
  tenantId?: string;
}): Promise<boolean> {
  await ensurePaymentGatewaySchema();

  const result = await db.execute(sql`
    UPDATE payment_transactions
    SET
      status = ${opts.paymentStatus},
      payment_status = ${opts.paymentStatus},
      gateway_payment_id = COALESCE(${opts.gatewayPaymentId ?? null}, gateway_payment_id),
      webhook_event_id = COALESCE(${opts.webhookEventId ?? null}, webhook_event_id),
      updated_at = NOW()
    WHERE transaction_reference = ${opts.transactionReference}
      ${opts.tenantId ? sql`AND office_id = ${opts.tenantId}` : sql``}
    RETURNING id
  `) as { rows?: unknown[] };

  const rows = Array.isArray(result) ? result : result?.rows ?? [];
  return rows.length > 0;
}

export async function updatePaymentByGatewayId(opts: {
  gatewayPaymentId: string;
  paymentStatus: PaymentStatusValue;
  webhookEventId?: string;
  tenantId?: string;
}): Promise<boolean> {
  await ensurePaymentGatewaySchema();

  const result = await db.execute(sql`
    UPDATE payment_transactions
    SET
      status = ${opts.paymentStatus},
      payment_status = ${opts.paymentStatus},
      webhook_event_id = COALESCE(${opts.webhookEventId ?? null}, webhook_event_id),
      updated_at = NOW()
    WHERE gateway_payment_id = ${opts.gatewayPaymentId}
      ${opts.tenantId ? sql`AND office_id = ${opts.tenantId}` : sql``}
    RETURNING id
  `) as { rows?: unknown[] };

  const rows = Array.isArray(result) ? result : result?.rows ?? [];
  return rows.length > 0;
}

export async function findByTransactionReference(
  ref: string
): Promise<PaymentTransactionRecord | null> {
  const result = await db.execute(sql`
    SELECT id, office_id, invoice_id, subscription_id, customer_id,
           payment_provider, payment_status, transaction_reference,
           gateway_payment_id, webhook_event_id, amount, description
    FROM payment_transactions
    WHERE transaction_reference = ${ref}
    LIMIT 1
  `) as { rows?: Record<string, unknown>[] };

  const row = (Array.isArray(result) ? result[0] : result?.rows?.[0]) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export async function markLinkedInvoicePaid(
  invoiceId?: string | null
): Promise<void> {
  if (!invoiceId) return;
  await db.execute(sql`
    UPDATE invoices
    SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE id = ${invoiceId} AND status IS DISTINCT FROM 'paid'
  `).catch(() => {});
}

function mapRow(row: Record<string, unknown>): PaymentTransactionRecord {
  return {
    id: String(row.id),
    tenantId: String(row.office_id),
    invoiceId: row.invoice_id as string | null,
    subscriptionId: row.subscription_id as string | null,
    customerId: row.customer_id as string | null,
    paymentProvider: (row.payment_provider ?? row.gateway ?? "moyasar") as PaymentProviderId,
    paymentStatus: (row.payment_status ?? row.status ?? "pending") as PaymentStatusValue,
    transactionReference: String(row.transaction_reference ?? row.gateway_payment_id ?? ""),
    gatewayPaymentId: row.gateway_payment_id as string | null,
    webhookEventId: row.webhook_event_id as string | null,
    amount: Number(row.amount ?? 0),
    description: row.description as string | null,
  };
}
