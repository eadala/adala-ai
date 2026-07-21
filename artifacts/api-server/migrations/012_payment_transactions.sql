-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 012: payment_transactions (Schema Authority Batch 4)
--
-- Owns the complete payment_transactions schema, including columns previously
-- added at module load by ensurePaymentCols() in
-- artifacts/api-server/src/modules/financial/payments.ts:
--   settlement_status, settled_at, settlement_ref,
--   gateway, gateway_payment_id, payment_link
--
-- Also formalizes core columns proven from INSERT/UPDATE/SELECT usage across
-- payments.ts, webhook.ts, financial.engine.ts, financialCore.ts.
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS for fresh DBs
--   - ADD COLUMN IF NOT EXISTS repairs partial tables (no type rewrite, no NOT NULL force)
--   - settlement_status CHECK skipped with WARNING if invalid legacy values exist
--   - unique stripe_event_id skipped with WARNING if duplicate non-null values exist
--   - column repairs still COMMIT when CHECK/unique are skipped
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── payment_transactions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id                 TEXT NOT NULL,
  client_name               TEXT,
  description               TEXT,
  amount                    NUMERIC NOT NULL,
  currency                  TEXT DEFAULT 'SAR',
  platform_fee              NUMERIC,
  net_amount                NUMERIC,
  stripe_fee                NUMERIC,
  status                    TEXT NOT NULL DEFAULT 'pending',
  payment_method            TEXT,
  invoice_id                TEXT,
  case_id                   TEXT,
  stripe_payment_intent_id  TEXT,
  stripe_event_id           TEXT,
  gateway                   TEXT DEFAULT 'manual',
  gateway_payment_id        TEXT,
  payment_link              TEXT,
  settlement_status         TEXT DEFAULT 'unsettled',
  settled_at                TIMESTAMP,
  settlement_ref            TEXT,
  metadata                  JSONB,
  created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP
);

-- Idempotent column adds for older/partial production tables (nullable — no NOT NULL force)
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS platform_fee NUMERIC;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS net_amount NUMERIC;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS stripe_fee NUMERIC;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS gateway TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_link TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS settlement_status TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS settlement_ref TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Defaults matching former ensurePaymentCols / production expectations
ALTER TABLE payment_transactions ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE payment_transactions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE payment_transactions ALTER COLUMN gateway SET DEFAULT 'manual';
ALTER TABLE payment_transactions ALTER COLUMN settlement_status SET DEFAULT 'unsettled';
ALTER TABLE payment_transactions ALTER COLUMN created_at SET DEFAULT NOW();

-- settlement_status CHECK — preflight: skip with WARNING if invalid legacy values exist
DO $$
DECLARE
  invalid_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%settlement_status%'
      AND pg_get_constraintdef(oid) ILIKE '%unsettled%'
      AND pg_get_constraintdef(oid) ILIKE '%settled%'
  ) THEN
    SELECT COUNT(*) INTO invalid_cnt
    FROM payment_transactions
    WHERE settlement_status IS NOT NULL
      AND settlement_status NOT IN ('unsettled', 'settled');

    IF invalid_cnt > 0 THEN
      RAISE WARNING
        '012_payment_transactions: skipping settlement_status CHECK — % row(s) have settlement_status outside (unsettled, settled); cleanup required before constraint can be added',
        invalid_cnt;
    ELSE
      ALTER TABLE payment_transactions
        ADD CONSTRAINT payment_transactions_settlement_status_check
        CHECK (settlement_status IS NULL OR settlement_status IN ('unsettled', 'settled'));
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN check_violation THEN
    RAISE WARNING
      '012_payment_transactions: skipping settlement_status CHECK — check_violation on legacy data; cleanup required';
END $$;

-- Unique stripe_event_id — preflight: skip if duplicate non-null values exist
DO $$
DECLARE
  dup_cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_transactions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%stripe_event_id%'
  ) OR EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'payment_transactions'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%stripe_event_id%'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_cnt
  FROM (
    SELECT stripe_event_id
    FROM payment_transactions
    WHERE stripe_event_id IS NOT NULL
    GROUP BY stripe_event_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_cnt > 0 THEN
    RAISE WARNING
      '012_payment_transactions: skipping unique stripe_event_id — % duplicate non-null value(s); duplicate cleanup required before unique index can be added',
      dup_cnt;
  ELSE
    EXECUTE $idx$
      CREATE UNIQUE INDEX idx_payment_transactions_stripe_event_id
        ON payment_transactions(stripe_event_id)
        WHERE stripe_event_id IS NOT NULL
    $idx$;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN unique_violation THEN
    RAISE WARNING
      '012_payment_transactions: skipping unique stripe_event_id — unique_violation on legacy data; duplicate cleanup required';
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_office_id
  ON payment_transactions(office_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
  ON payment_transactions(status);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_payment_id
  ON payment_transactions(gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

COMMIT;
