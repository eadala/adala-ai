-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 002: Payment Gateway metadata columns on payment_transactions
-- Required for PaymentService (Moyasar primary, multi-provider abstraction)
--
-- Apply manually — NOT run automatically at app boot:
--   psql "$DATABASE_URL" -f artifacts/api-server/migrations/002_payment_gateway_metadata.sql
--
-- Run on staging first, then production during a maintenance window.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Step 1: Gateway metadata columns ───────────────────────────────────────
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS subscription_id       TEXT,
  ADD COLUMN IF NOT EXISTS customer_id           TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider      TEXT,
  ADD COLUMN IF NOT EXISTS payment_status        TEXT,
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
  ADD COLUMN IF NOT EXISTS webhook_event_id      TEXT;

-- ── Step 2: Backfill from legacy columns where present ───────────────────────
UPDATE payment_transactions
SET payment_provider = COALESCE(payment_provider, gateway, payment_method, 'manual')
WHERE payment_provider IS NULL;

UPDATE payment_transactions
SET payment_status = COALESCE(payment_status, status, 'pending')
WHERE payment_status IS NULL;

UPDATE payment_transactions
SET transaction_reference = COALESCE(
  transaction_reference,
  gateway_payment_id,
  stripe_payment_intent_id::text
)
WHERE transaction_reference IS NULL
  AND (gateway_payment_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL);

-- ── Step 3: Query indexes for webhook / status lookups ───────────────────────
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_reference
  ON payment_transactions (transaction_reference)
  WHERE transaction_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_payment_id
  ON payment_transactions (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_provider
  ON payment_transactions (payment_provider);

COMMIT;
