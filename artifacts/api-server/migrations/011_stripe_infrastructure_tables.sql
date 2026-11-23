-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 011: Stripe infrastructure tables (Schema Authority Batch 3)
--
-- Owns:
--   stripe_events
--   stripe_dead_letters
--   stripe_reconciliation_log
--
-- Source of truth (former Runtime DDL):
--   ensureStripeBufferTables()  — artifacts/api-server/src/services/stripeEventBuffer.ts
--   ensureReconciliationTable() — artifacts/api-server/src/jobs/stripeReconcile.ts
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008 → 009 → 010
-- Idempotent / legacy-safe:
--   - ADD COLUMN IF NOT EXISTS repairs partial tables (no type rewrite, no NOT NULL force)
--   - status CHECK skipped with WARNING if invalid legacy non-null values exist
--   - unique stripe_event_id skipped with WARNING if duplicate non-null values exist
--   - column repairs still COMMIT when CHECK/unique are skipped
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── stripe_events ──────────────────────────────────────────────────────────
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
);

-- Idempotent column adds for older/partial production tables (nullable — no NOT NULL force)
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS retry_count INTEGER;
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE stripe_events ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE stripe_events ALTER COLUMN retry_count SET DEFAULT 0;
ALTER TABLE stripe_events ALTER COLUMN created_at SET DEFAULT NOW();

-- status CHECK — preflight: skip with WARNING if invalid legacy non-null status values exist
DO $$
DECLARE
  invalid_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stripe_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%pending%processing%done%failed%'
  ) THEN
    SELECT COUNT(*) INTO invalid_cnt
    FROM stripe_events
    WHERE status IS NOT NULL
      AND status NOT IN ('pending', 'processing', 'done', 'failed');

    IF invalid_cnt > 0 THEN
      RAISE WARNING
        '011_stripe_infra: skipping stripe_events status CHECK — % row(s) have status outside (pending, processing, done, failed); cleanup required before constraint can be added',
        invalid_cnt;
    ELSE
      ALTER TABLE stripe_events
        ADD CONSTRAINT stripe_events_status_check
        CHECK (status IN ('pending','processing','done','failed'));
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Unique stripe_event_id — preflight: skip if duplicate non-null values exist
DO $$
DECLARE
  dup_cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stripe_events'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%stripe_event_id%'
  ) OR EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'stripe_events'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%stripe_event_id%'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_cnt
  FROM (
    SELECT stripe_event_id
    FROM stripe_events
    WHERE stripe_event_id IS NOT NULL
    GROUP BY stripe_event_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_cnt > 0 THEN
    RAISE WARNING
      '011_stripe_infra: skipping unique stripe_events.stripe_event_id — % duplicate non-null value(s); duplicate cleanup required before unique constraint can be added',
      dup_cnt;
  ELSE
    ALTER TABLE stripe_events
      ADD CONSTRAINT stripe_events_stripe_event_id_key UNIQUE (stripe_event_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_stripe_events_status
  ON stripe_events(status) WHERE status IN ('pending','failed');

CREATE INDEX IF NOT EXISTS idx_stripe_events_created
  ON stripe_events(created_at DESC);

-- ── stripe_dead_letters ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_dead_letters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  TEXT NOT NULL,
  type             TEXT NOT NULL,
  payload          JSONB NOT NULL,
  error            TEXT NOT NULL,
  retry_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stripe_dead_letters ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;
ALTER TABLE stripe_dead_letters ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE stripe_dead_letters ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE stripe_dead_letters ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE stripe_dead_letters ADD COLUMN IF NOT EXISTS retry_count INTEGER;
ALTER TABLE stripe_dead_letters ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE stripe_dead_letters ALTER COLUMN retry_count SET DEFAULT 0;
ALTER TABLE stripe_dead_letters ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_stripe_dlq_created
  ON stripe_dead_letters(created_at DESC);

-- ── stripe_reconciliation_log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_reconciliation_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  stripe_count  INTEGER NOT NULL DEFAULT 0,
  db_count      INTEGER NOT NULL DEFAULT 0,
  missing_count INTEGER NOT NULL DEFAULT 0,
  drift_count   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','drift','error')),
  details       JSONB,
  error         TEXT
);

ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS run_at TIMESTAMPTZ;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS stripe_count INTEGER;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS db_count INTEGER;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS missing_count INTEGER;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS drift_count INTEGER;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE stripe_reconciliation_log ADD COLUMN IF NOT EXISTS error TEXT;

ALTER TABLE stripe_reconciliation_log ALTER COLUMN run_at SET DEFAULT NOW();
ALTER TABLE stripe_reconciliation_log ALTER COLUMN stripe_count SET DEFAULT 0;
ALTER TABLE stripe_reconciliation_log ALTER COLUMN db_count SET DEFAULT 0;
ALTER TABLE stripe_reconciliation_log ALTER COLUMN missing_count SET DEFAULT 0;
ALTER TABLE stripe_reconciliation_log ALTER COLUMN drift_count SET DEFAULT 0;
ALTER TABLE stripe_reconciliation_log ALTER COLUMN status SET DEFAULT 'ok';

-- status CHECK — preflight: skip with WARNING if invalid legacy non-null status values exist
DO $$
DECLARE
  invalid_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stripe_reconciliation_log'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%ok%drift%error%'
  ) THEN
    SELECT COUNT(*) INTO invalid_cnt
    FROM stripe_reconciliation_log
    WHERE status IS NOT NULL
      AND status NOT IN ('ok', 'drift', 'error');

    IF invalid_cnt > 0 THEN
      RAISE WARNING
        '011_stripe_infra: skipping stripe_reconciliation_log status CHECK — % row(s) have status outside (ok, drift, error); cleanup required before constraint can be added',
        invalid_cnt;
    ELSE
      ALTER TABLE stripe_reconciliation_log
        ADD CONSTRAINT stripe_reconciliation_log_status_check
        CHECK (status IN ('ok','drift','error'));
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_reconciliation_run_at
  ON stripe_reconciliation_log(run_at DESC);

COMMIT;
