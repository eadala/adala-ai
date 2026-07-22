-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017: Cases schema columns required by legal-core + Demo seed
--
-- Owns (ADD COLUMN IF NOT EXISTS — no type rewrite of existing columns):
--   cases.case_number
--   cases.court_name / court_code / court_city
--   cases.court_district_number / court_district_type
--   cases.next_hearing_date
--   cases.deleted_at
--   cases.version
--   idx_uq_cases_office_case_number
--
-- Root cause of Production Demo seed 42703:
--   INSERT ... case_number ... failed because case_number was never migrated.
--   Active cases API (GET / PATCH court / unique index) already requires these.
--
-- Apply AFTER: 003 → 001 → 004 → … → 016
-- Idempotent / legacy-safe. Does NOT drop, rename, or backfill Production data.
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'cases'
  ) THEN
    RAISE WARNING '017_cases: skipping column repair — cases table missing';
    RETURN;
  END IF;

  ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_number TEXT;
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_name TEXT;
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_code TEXT;
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_city TEXT;
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_district_number INTEGER;
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_district_type TEXT;
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS next_hearing_date TIMESTAMPTZ;
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS version INTEGER;

  -- Default for new rows / null legacy rows (nullable ADD keeps existing rows intact)
  ALTER TABLE cases ALTER COLUMN version SET DEFAULT 1;
  UPDATE cases SET version = 1 WHERE version IS NULL;
EXCEPTION
  WHEN undefined_table THEN
    RAISE WARNING '017_cases: skipping column repair — cases table missing';
  WHEN others THEN
    RAISE WARNING '017_cases: column repair skipped — %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'case_number'
  ) THEN
    RAISE WARNING '017_cases: skipping idx_uq_cases_office_case_number — case_number missing';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_cases_office_case_number
    ON cases (office_id, case_number)
    WHERE case_number IS NOT NULL;
EXCEPTION
  WHEN undefined_table THEN
    RAISE WARNING '017_cases: skipping unique index — cases missing';
  WHEN undefined_column THEN
    RAISE WARNING '017_cases: skipping unique index — case_number missing';
  WHEN others THEN
    RAISE WARNING '017_cases: unique index skipped — %', SQLERRM;
END $$;

COMMIT;
