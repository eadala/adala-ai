-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 028: Autopilot schema authority — case_autopilot_reports
-- (Stage 19 / P2)
--
-- Previously created only via Runtime DDL in agents/caseAutopilot.ts
-- (ensureAutopilotTable) with CREATE TABLE IF NOT EXISTS + idx_autopilot_office.
--
-- Source of truth (proven from caseAutopilot + cases routes + listener):
--   case_autopilot_reports:
--     columns: case_id, office_id, health_score, grade, risks, missing_data,
--              next_steps, tasks_created, outcome_prediction, ai_summary, run_at
--     PRIMARY KEY / UNIQUE(case_id) — ON CONFLICT (case_id) upsert arbiter
--     INDEX idx_autopilot_office (office_id)
--     WRITE: INSERT … ON CONFLICT (case_id) DO UPDATE (runCaseAutopilot)
--     READ:  WHERE case_id = :id AND office_id = :tenantId
--
-- ON CONFLICT (case_id) arbiter rules (must match preflight-028):
--   Accept ONLY:
--     - PRIMARY KEY on exactly (case_id), OR
--     - UNIQUE constraint on exactly (case_id), OR
--     - unique index that is ALL of: unique, valid, exactly one key column,
--       column is case_id, indpred IS NULL, indexprs IS NULL
--   Reject: partial UNIQUE, expression UNIQUE, multi-column unique, invalid indexes
--
-- Apply AFTER: … → 027
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS for fresh DBs
--   - ADD COLUMN IF NOT EXISTS repairs partial legacy tables
--   - PK/UNIQUE(case_id) is REQUIRED (ON CONFLICT upsert).
--     Duplicate/NULL case_id → RAISE EXCEPTION / abort (never warn-and-continue).
--   - Migration never COMMITs without a proven ON CONFLICT (case_id) arbiter.
--   - no DROP TABLE / DROP COLUMN / type rewrite / forced NOT NULL on legacy
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- Do NOT deploy/apply this file from the PR agent — ops apply out-of-band.
-- Do NOT backfill office_id from the current requester.
--
-- Ops order:
--   1) psql -f scripts/db/preflight-migration-028.sql
--   2) if chosen_action starts with BLOCKED_ → clean / repair; do NOT apply yet
--   3) apply this migration
--   4) verify PRIMARY KEY or UNIQUE(case_id) exists (ON CONFLICT arbiter)
--   5) deploy API (ensureAutopilotTable removed)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fresh installs: PK(case_id); office_id NOT NULL with NO invent default.
CREATE TABLE IF NOT EXISTS case_autopilot_reports (
  case_id            TEXT PRIMARY KEY,
  office_id          TEXT NOT NULL,
  health_score       INTEGER NOT NULL DEFAULT 0,
  grade              TEXT NOT NULL DEFAULT 'F',
  risks              JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_data       JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps         JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks_created      INTEGER NOT NULL DEFAULT 0,
  outcome_prediction JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary         TEXT,
  run_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy / partial repair — add missing columns without destructive rewrite.
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS health_score INTEGER;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS risks JSONB;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS missing_data JSONB;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS next_steps JSONB;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS tasks_created INTEGER;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS outcome_prediction JSONB;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE case_autopilot_reports ADD COLUMN IF NOT EXISTS run_at TIMESTAMPTZ;

ALTER TABLE case_autopilot_reports ALTER COLUMN health_score SET DEFAULT 0;
ALTER TABLE case_autopilot_reports ALTER COLUMN grade SET DEFAULT 'F';
ALTER TABLE case_autopilot_reports ALTER COLUMN risks SET DEFAULT '[]'::jsonb;
ALTER TABLE case_autopilot_reports ALTER COLUMN missing_data SET DEFAULT '[]'::jsonb;
ALTER TABLE case_autopilot_reports ALTER COLUMN next_steps SET DEFAULT '[]'::jsonb;
ALTER TABLE case_autopilot_reports ALTER COLUMN tasks_created SET DEFAULT 0;
ALTER TABLE case_autopilot_reports ALTER COLUMN outcome_prediction SET DEFAULT '{}'::jsonb;
ALTER TABLE case_autopilot_reports ALTER COLUMN run_at SET DEFAULT NOW();

-- PRIMARY KEY / UNIQUE(case_id) for ON CONFLICT (case_id) — required.
DO $$
DECLARE
  dup_cnt BIGINT;
  null_case_cnt BIGINT;
  has_case_arbiter BOOLEAN;
BEGIN
  /* Exact arbiter rules — shared with preflight-028 */
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.case_autopilot_reports'::regclass
      AND c.contype IN ('p', 'u')
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.conrelid
          AND a.attnum = c.conkey[1]
          AND NOT a.attisdropped
          AND a.attname = 'case_id'
      )
  ) INTO has_case_arbiter;

  IF NOT has_case_arbiter THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_index x
      WHERE x.indrelid = 'public.case_autopilot_reports'::regclass
        AND x.indisunique
        AND x.indisvalid
        AND x.indpred IS NULL
        AND x.indexprs IS NULL
        AND x.indnkeyatts = 1
        AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = x.indrelid
            AND a.attnum = x.indkey[0]
            AND NOT a.attisdropped
            AND a.attname = 'case_id'
        )
    ) INTO has_case_arbiter;
  END IF;

  IF has_case_arbiter THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO null_case_cnt
  FROM case_autopilot_reports
  WHERE case_id IS NULL;

  IF null_case_cnt > 0 THEN
    RAISE EXCEPTION
      '028_autopilot: % row(s) with NULL case_id; clean before PRIMARY KEY (case_id) required by ON CONFLICT (chosen_action=BLOCKED_CLEAN_DUPLICATES)',
      null_case_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt
  FROM (
    SELECT case_id
    FROM case_autopilot_reports
    WHERE case_id IS NOT NULL
    GROUP BY case_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '028_autopilot: % duplicate case_id group(s); clean duplicates before PRIMARY KEY (case_id) required by ON CONFLICT (chosen_action=BLOCKED_CLEAN_DUPLICATES)',
      dup_cnt;
  END IF;

  ALTER TABLE case_autopilot_reports
    ADD CONSTRAINT case_autopilot_reports_pkey PRIMARY KEY (case_id);
END $$;

-- Hard gate: never COMMIT without a proven ON CONFLICT (case_id) arbiter.
DO $$
DECLARE
  has_case_arbiter BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.case_autopilot_reports'::regclass
      AND c.contype IN ('p', 'u')
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.conrelid
          AND a.attnum = c.conkey[1]
          AND NOT a.attisdropped
          AND a.attname = 'case_id'
      )
  ) INTO has_case_arbiter;

  IF NOT has_case_arbiter THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_index x
      WHERE x.indrelid = 'public.case_autopilot_reports'::regclass
        AND x.indisunique
        AND x.indisvalid
        AND x.indpred IS NULL
        AND x.indexprs IS NULL
        AND x.indnkeyatts = 1
        AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = x.indrelid
            AND a.attnum = x.indkey[0]
            AND NOT a.attisdropped
            AND a.attname = 'case_id'
        )
    ) INTO has_case_arbiter;
  END IF;

  IF NOT has_case_arbiter THEN
    RAISE EXCEPTION
      '028_autopilot: ON CONFLICT (case_id) arbiter missing after apply — need PRIMARY KEY/UNIQUE(case_id) (or non-partial non-expression unique index on case_id only); aborting';
  END IF;

  /* Prove Autopilot upsert inference before COMMIT */
  BEGIN
    INSERT INTO case_autopilot_reports
      (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
       tasks_created, outcome_prediction, ai_summary, run_at)
    VALUES (
      '__mig028_on_conflict_probe__',
      '00000000-0000-4000-8000-000000000000',
      0, 'F', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      0, '{}'::jsonb, NULL, NOW()
    )
    ON CONFLICT (case_id) DO NOTHING;

    DELETE FROM case_autopilot_reports
    WHERE case_id = '__mig028_on_conflict_probe__';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION
      '028_autopilot: ON CONFLICT (case_id) probe failed — arbiter not usable for Autopilot upsert: %',
      SQLERRM;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_autopilot_office
  ON case_autopilot_reports (office_id);

COMMIT;
