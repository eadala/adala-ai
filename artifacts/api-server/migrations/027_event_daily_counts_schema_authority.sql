-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 027: Analytics schema authority — event_daily_counts
-- (Stage 16.5)
--
-- Previously created only via Runtime DDL in analyticsListener.ts with
-- office_id DEFAULT 'default'. Wildcard listener upserted counts using
-- event.officeId ?? "default", inventing non-canonical ownership.
--
-- Source of truth (proven from analyticsListener + JLWM reads):
--   event_daily_counts:
--     columns: id, event_type, office_id, event_date, count
--     UNIQUE(event_type, office_id, event_date) — ON CONFLICT upsert
--     READ: enterpriseReport COUNT WHERE office_id = :officeId
--
-- Apply AFTER: … → 026
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS for fresh DBs
--   - ADD COLUMN IF NOT EXISTS repairs partial legacy tables
--   - DROP DEFAULT on office_id when it was 'default' (non-destructive)
--   - UNIQUE skipped with WARNING if duplicate key groups exist
--   - no DROP TABLE / DROP COLUMN / type rewrite / forced NOT NULL on legacy
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- Do NOT deploy/apply this file from the PR agent — ops apply out-of-band.
-- Do NOT backfill office_id from the current requester.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fresh installs: office_id is NOT NULL with NO default of 'default'.
CREATE TABLE IF NOT EXISTS event_daily_counts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  office_id   TEXT NOT NULL,
  event_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  count       INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE event_daily_counts ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE event_daily_counts ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE event_daily_counts ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE event_daily_counts ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE event_daily_counts ADD COLUMN IF NOT EXISTS count INTEGER;

ALTER TABLE event_daily_counts ALTER COLUMN event_date SET DEFAULT CURRENT_DATE;
ALTER TABLE event_daily_counts ALTER COLUMN count SET DEFAULT 1;

-- Remove legacy DEFAULT 'default' on office_id (non-destructive; keeps rows).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_daily_counts'
      AND column_name = 'office_id'
      AND column_default IS NOT NULL
      AND (
        column_default ILIKE '%''default''%'
        OR column_default ILIKE '%"default"%'
      )
  ) THEN
    ALTER TABLE event_daily_counts ALTER COLUMN office_id DROP DEFAULT;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- UNIQUE(event_type, office_id, event_date) for ON CONFLICT upsert
DO $$
DECLARE
  dup_cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_daily_counts'::regclass
      AND contype IN ('u', 'p')
      AND (
        pg_get_constraintdef(oid) ILIKE '%(event_type, office_id, event_date)%'
        OR pg_get_constraintdef(oid) ILIKE '%(event_type,%office_id,%event_date)%'
      )
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'event_daily_counts_event_type_office_id_event_date_key',
        'uq_event_daily_counts_type_office_date'
      )
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_cnt
  FROM (
    SELECT event_type, office_id, event_date
    FROM event_daily_counts
    WHERE event_type IS NOT NULL AND office_id IS NOT NULL AND event_date IS NOT NULL
    GROUP BY event_type, office_id, event_date
    HAVING COUNT(*) > 1
  ) d;

  IF dup_cnt > 0 THEN
    RAISE WARNING
      '027_analytics: skipping UNIQUE(event_type, office_id, event_date) — % duplicate group(s); cleanup required before constraint can be added',
      dup_cnt;
  ELSE
    BEGIN
      ALTER TABLE event_daily_counts
        ADD CONSTRAINT uq_event_daily_counts_type_office_date
        UNIQUE (event_type, office_id, event_date);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN invalid_table_definition THEN NULL;
    END;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_daily_counts_office_id
  ON event_daily_counts (office_id);

CREATE INDEX IF NOT EXISTS idx_event_daily_counts_office_date
  ON event_daily_counts (office_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_event_daily_counts_event_date
  ON event_daily_counts (event_date DESC);

CREATE INDEX IF NOT EXISTS idx_event_daily_counts_event_type
  ON event_daily_counts (event_type);

COMMIT;
