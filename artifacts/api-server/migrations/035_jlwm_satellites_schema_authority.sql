-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 035: JLWM Satellites schema authority (Stage 4C)
--
-- Owns exactly the 6 satellite tables previously created by Runtime DDL:
--   jlwm_future_paths
--   jlwm_simulations
--   jlwm_litigation_intel
--   jlwm_accuracy_records
--   jlwm_executive_reports
--   jlwm_coo_actions
--
-- Does NOT own JLWM Core (034) or Reliability tables (036).
-- Does NOT invent UNIQUE arbiters.
-- Does NOT invent/remap/delete tenant office_id values.
-- No FKs. No new UNIQUE constraints. No DROP TABLE / DROP INDEX.
-- Idempotent and fail-closed. Post-apply readiness must pass before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1) jlwm_future_paths ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_future_paths (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id     TEXT NOT NULL,
  subject_type  TEXT NOT NULL,
  subject_id    TEXT,
  optimistic    JSONB NOT NULL DEFAULT '{}',
  realistic     JSONB NOT NULL DEFAULT '{}',
  pessimistic   JSONB NOT NULL DEFAULT '{}',
  model_used    TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS subject_type TEXT;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS subject_id TEXT;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS optimistic JSONB;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS realistic JSONB;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS pessimistic JSONB;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE jlwm_future_paths ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── 2) jlwm_simulations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_simulations (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id           TEXT NOT NULL,
  case_id             TEXT NOT NULL,
  scenario_type       TEXT NOT NULL,
  scenario_params     JSONB NOT NULL DEFAULT '{}',
  outcomes            JSONB NOT NULL DEFAULT '[]',
  recommended_outcome TEXT,
  model_used          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS scenario_type TEXT;
ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS scenario_params JSONB;
ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS outcomes JSONB;
ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS recommended_outcome TEXT;
ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE jlwm_simulations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── 3) jlwm_litigation_intel ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_litigation_intel (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id           TEXT NOT NULL,
  case_id             TEXT NOT NULL,
  strengths           JSONB NOT NULL DEFAULT '[]',
  weaknesses          JSONB NOT NULL DEFAULT '[]',
  missing_evidence    JSONB NOT NULL DEFAULT '[]',
  procedural_risks    JSONB NOT NULL DEFAULT '[]',
  recommended_actions JSONB NOT NULL DEFAULT '[]',
  overall_score       FLOAT NOT NULL DEFAULT 0.5,
  confidence          FLOAT NOT NULL DEFAULT 0.5,
  model_used          TEXT,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS strengths JSONB;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS weaknesses JSONB;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS missing_evidence JSONB;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS procedural_risks JSONB;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS recommended_actions JSONB;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS overall_score FLOAT;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS confidence FLOAT;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE jlwm_litigation_intel ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── 4) jlwm_accuracy_records ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_accuracy_records (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id        TEXT NOT NULL,
  prediction_id    TEXT,
  case_id          TEXT NOT NULL,
  prediction_type  TEXT NOT NULL,
  predicted_value  JSONB NOT NULL DEFAULT '{}',
  actual_value     JSONB NOT NULL DEFAULT '{}',
  accuracy_score   FLOAT,
  deviation        FLOAT,
  notes            TEXT,
  recorded_by      TEXT,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS prediction_id TEXT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS prediction_type TEXT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS predicted_value JSONB;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS actual_value JSONB;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS accuracy_score FLOAT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS deviation FLOAT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE jlwm_accuracy_records ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ;

-- ── 5) jlwm_executive_reports ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_executive_reports (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id           TEXT NOT NULL,
  report_type         TEXT NOT NULL DEFAULT 'weekly',
  period_start        TIMESTAMPTZ NOT NULL,
  period_end          TIMESTAMPTZ NOT NULL,
  executive_summary   TEXT,
  kpis                JSONB NOT NULL DEFAULT '{}',
  revenue_forecast    JSONB NOT NULL DEFAULT '{}',
  risk_concentration  JSONB NOT NULL DEFAULT '{}',
  lawyer_performance  JSONB NOT NULL DEFAULT '[]',
  client_risk         JSONB NOT NULL DEFAULT '[]',
  opportunities       JSONB NOT NULL DEFAULT '[]',
  alerts              JSONB NOT NULL DEFAULT '[]',
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_used          TEXT,
  generation_ms       INT
);

ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS report_type TEXT;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS executive_summary TEXT;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS kpis JSONB;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS revenue_forecast JSONB;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS risk_concentration JSONB;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS lawyer_performance JSONB;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS client_risk JSONB;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS opportunities JSONB;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS alerts JSONB;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE jlwm_executive_reports ADD COLUMN IF NOT EXISTS generation_ms INT;

-- ── 6) jlwm_coo_actions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_coo_actions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id        TEXT NOT NULL,
  action_type      TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  priority         TEXT NOT NULL DEFAULT 'medium',
  status           TEXT NOT NULL DEFAULT 'pending_approval',
  target_ref       JSONB NOT NULL DEFAULT '{}',
  suggested_action JSONB NOT NULL DEFAULT '{}',
  ai_reasoning     TEXT,
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  rejected_by      TEXT,
  rejected_at      TIMESTAMPTZ,
  reject_reason    TEXT,
  executed_at      TIMESTAMPTZ,
  execution_result JSONB,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS target_ref JSONB;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS suggested_action JSONB;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS execution_result JSONB;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_coo_actions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation (no coercion) + NULL/non-UUID ownership blocks
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
  non_uuid_cnt BIGINT;
  tbl TEXT;
  uuid_re CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- future_paths
      ('jlwm_future_paths','id','text'),
      ('jlwm_future_paths','office_id','text'),
      ('jlwm_future_paths','subject_type','text'),
      ('jlwm_future_paths','subject_id','text'),
      ('jlwm_future_paths','optimistic','jsonb'),
      ('jlwm_future_paths','realistic','jsonb'),
      ('jlwm_future_paths','pessimistic','jsonb'),
      ('jlwm_future_paths','model_used','text'),
      ('jlwm_future_paths','expires_at','timestamptz'),
      ('jlwm_future_paths','created_at','timestamptz'),
      -- simulations
      ('jlwm_simulations','id','text'),
      ('jlwm_simulations','office_id','text'),
      ('jlwm_simulations','case_id','text'),
      ('jlwm_simulations','scenario_type','text'),
      ('jlwm_simulations','scenario_params','jsonb'),
      ('jlwm_simulations','outcomes','jsonb'),
      ('jlwm_simulations','recommended_outcome','text'),
      ('jlwm_simulations','model_used','text'),
      ('jlwm_simulations','created_at','timestamptz'),
      -- litigation_intel
      ('jlwm_litigation_intel','id','text'),
      ('jlwm_litigation_intel','office_id','text'),
      ('jlwm_litigation_intel','case_id','text'),
      ('jlwm_litigation_intel','strengths','jsonb'),
      ('jlwm_litigation_intel','weaknesses','jsonb'),
      ('jlwm_litigation_intel','missing_evidence','jsonb'),
      ('jlwm_litigation_intel','procedural_risks','jsonb'),
      ('jlwm_litigation_intel','recommended_actions','jsonb'),
      ('jlwm_litigation_intel','overall_score','float8'),
      ('jlwm_litigation_intel','confidence','float8'),
      ('jlwm_litigation_intel','model_used','text'),
      ('jlwm_litigation_intel','expires_at','timestamptz'),
      ('jlwm_litigation_intel','created_at','timestamptz'),
      -- accuracy_records
      ('jlwm_accuracy_records','id','text'),
      ('jlwm_accuracy_records','office_id','text'),
      ('jlwm_accuracy_records','prediction_id','text'),
      ('jlwm_accuracy_records','case_id','text'),
      ('jlwm_accuracy_records','prediction_type','text'),
      ('jlwm_accuracy_records','predicted_value','jsonb'),
      ('jlwm_accuracy_records','actual_value','jsonb'),
      ('jlwm_accuracy_records','accuracy_score','float8'),
      ('jlwm_accuracy_records','deviation','float8'),
      ('jlwm_accuracy_records','notes','text'),
      ('jlwm_accuracy_records','recorded_by','text'),
      ('jlwm_accuracy_records','recorded_at','timestamptz'),
      -- executive_reports
      ('jlwm_executive_reports','id','text'),
      ('jlwm_executive_reports','office_id','text'),
      ('jlwm_executive_reports','report_type','text'),
      ('jlwm_executive_reports','period_start','timestamptz'),
      ('jlwm_executive_reports','period_end','timestamptz'),
      ('jlwm_executive_reports','executive_summary','text'),
      ('jlwm_executive_reports','kpis','jsonb'),
      ('jlwm_executive_reports','revenue_forecast','jsonb'),
      ('jlwm_executive_reports','risk_concentration','jsonb'),
      ('jlwm_executive_reports','lawyer_performance','jsonb'),
      ('jlwm_executive_reports','client_risk','jsonb'),
      ('jlwm_executive_reports','opportunities','jsonb'),
      ('jlwm_executive_reports','alerts','jsonb'),
      ('jlwm_executive_reports','generated_at','timestamptz'),
      ('jlwm_executive_reports','model_used','text'),
      ('jlwm_executive_reports','generation_ms','int4'),
      -- coo_actions
      ('jlwm_coo_actions','id','text'),
      ('jlwm_coo_actions','office_id','text'),
      ('jlwm_coo_actions','action_type','text'),
      ('jlwm_coo_actions','title','text'),
      ('jlwm_coo_actions','description','text'),
      ('jlwm_coo_actions','priority','text'),
      ('jlwm_coo_actions','status','text'),
      ('jlwm_coo_actions','target_ref','jsonb'),
      ('jlwm_coo_actions','suggested_action','jsonb'),
      ('jlwm_coo_actions','ai_reasoning','text'),
      ('jlwm_coo_actions','approved_by','text'),
      ('jlwm_coo_actions','approved_at','timestamptz'),
      ('jlwm_coo_actions','rejected_by','text'),
      ('jlwm_coo_actions','rejected_at','timestamptz'),
      ('jlwm_coo_actions','reject_reason','text'),
      ('jlwm_coo_actions','executed_at','timestamptz'),
      ('jlwm_coo_actions','execution_result','jsonb'),
      ('jlwm_coo_actions','expires_at','timestamptz'),
      ('jlwm_coo_actions','created_at','timestamptz'),
      ('jlwm_coo_actions','updated_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;

    IF actual_udt IS NULL THEN
      RAISE EXCEPTION
        '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% missing after ADD COLUMN',
        spec.table_name, spec.column_name;
    END IF;
    IF actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, actual_udt, spec.udt_name;
    END IF;
  END LOOP;

  /* NULL office_id + non-UUID ownership (no invent/remap/delete) */
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_future_paths','jlwm_simulations','jlwm_litigation_intel',
    'jlwm_accuracy_records','jlwm_executive_reports','jlwm_coo_actions'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE office_id IS NULL', tbl) INTO null_cnt;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION
        '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_OFFICE_ID) — % row(s) with NULL office_id on %; no invent/remap',
        null_cnt, tbl;
    END IF;

    EXECUTE format(
      $q$SELECT COUNT(*) FROM %I WHERE office_id IS NOT NULL AND office_id !~ %L$q$,
      tbl, uuid_re
    ) INTO non_uuid_cnt;
    IF non_uuid_cnt > 0 THEN
      RAISE EXCEPTION
        '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NON_UUID_OFFICE_ID) — % non-UUID office_id row(s) on %; no invent/remap/delete',
        non_uuid_cnt, tbl;
    END IF;
  END LOOP;

  /* NULL case_id BLOCK before SET NOT NULL */
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_simulations','jlwm_litigation_intel','jlwm_accuracy_records'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE case_id IS NULL', tbl) INTO null_cnt;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION
        '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_CASE_ID) — % row(s) with NULL case_id on %; no invent/remap',
        null_cnt, tbl;
    END IF;
  END LOOP;

  /* NULL period_start / period_end BLOCK on executive before SET NOT NULL */
  SELECT COUNT(*) INTO null_cnt
  FROM jlwm_executive_reports
  WHERE period_start IS NULL OR period_end IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_PERIOD) — % row(s) with NULL period_start/period_end on jlwm_executive_reports',
      null_cnt;
  END IF;

  /* NULL required COO fields BLOCK before SET NOT NULL */
  SELECT COUNT(*) INTO null_cnt
  FROM jlwm_coo_actions
  WHERE id IS NULL OR office_id IS NULL OR action_type IS NULL OR title IS NULL
    OR description IS NULL OR priority IS NULL OR status IS NULL
    OR target_ref IS NULL OR suggested_action IS NULL
    OR created_at IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_coo_actions has % row(s) with NULL required columns',
      null_cnt;
  END IF;
END $$;

-- Safe defaults (values unchanged)
ALTER TABLE jlwm_future_paths ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_future_paths ALTER COLUMN optimistic SET DEFAULT '{}';
ALTER TABLE jlwm_future_paths ALTER COLUMN realistic SET DEFAULT '{}';
ALTER TABLE jlwm_future_paths ALTER COLUMN pessimistic SET DEFAULT '{}';
ALTER TABLE jlwm_future_paths ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE jlwm_simulations ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_simulations ALTER COLUMN scenario_params SET DEFAULT '{}';
ALTER TABLE jlwm_simulations ALTER COLUMN outcomes SET DEFAULT '[]';
ALTER TABLE jlwm_simulations ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE jlwm_litigation_intel ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_litigation_intel ALTER COLUMN strengths SET DEFAULT '[]';
ALTER TABLE jlwm_litigation_intel ALTER COLUMN weaknesses SET DEFAULT '[]';
ALTER TABLE jlwm_litigation_intel ALTER COLUMN missing_evidence SET DEFAULT '[]';
ALTER TABLE jlwm_litigation_intel ALTER COLUMN procedural_risks SET DEFAULT '[]';
ALTER TABLE jlwm_litigation_intel ALTER COLUMN recommended_actions SET DEFAULT '[]';
ALTER TABLE jlwm_litigation_intel ALTER COLUMN overall_score SET DEFAULT 0.5;
ALTER TABLE jlwm_litigation_intel ALTER COLUMN confidence SET DEFAULT 0.5;
ALTER TABLE jlwm_litigation_intel ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE jlwm_accuracy_records ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_accuracy_records ALTER COLUMN predicted_value SET DEFAULT '{}';
ALTER TABLE jlwm_accuracy_records ALTER COLUMN actual_value SET DEFAULT '{}';
ALTER TABLE jlwm_accuracy_records ALTER COLUMN recorded_at SET DEFAULT NOW();

ALTER TABLE jlwm_executive_reports ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_executive_reports ALTER COLUMN report_type SET DEFAULT 'weekly';
ALTER TABLE jlwm_executive_reports ALTER COLUMN kpis SET DEFAULT '{}';
ALTER TABLE jlwm_executive_reports ALTER COLUMN revenue_forecast SET DEFAULT '{}';
ALTER TABLE jlwm_executive_reports ALTER COLUMN risk_concentration SET DEFAULT '{}';
ALTER TABLE jlwm_executive_reports ALTER COLUMN lawyer_performance SET DEFAULT '[]';
ALTER TABLE jlwm_executive_reports ALTER COLUMN client_risk SET DEFAULT '[]';
ALTER TABLE jlwm_executive_reports ALTER COLUMN opportunities SET DEFAULT '[]';
ALTER TABLE jlwm_executive_reports ALTER COLUMN alerts SET DEFAULT '[]';
ALTER TABLE jlwm_executive_reports ALTER COLUMN generated_at SET DEFAULT NOW();

ALTER TABLE jlwm_coo_actions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_coo_actions ALTER COLUMN priority SET DEFAULT 'medium';
ALTER TABLE jlwm_coo_actions ALTER COLUMN status SET DEFAULT 'pending_approval';
ALTER TABLE jlwm_coo_actions ALTER COLUMN target_ref SET DEFAULT '{}';
ALTER TABLE jlwm_coo_actions ALTER COLUMN suggested_action SET DEFAULT '{}';
ALTER TABLE jlwm_coo_actions ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_coo_actions ALTER COLUMN updated_at SET DEFAULT NOW();

-- Safe SET NOT NULL on required columns (NULLs already blocked for office_id /
-- case_id / period / COO required; other required columns: BLOCK if NULL rows)
DO $$
DECLARE
  null_cnt BIGINT;
BEGIN
  SELECT COUNT(*) INTO null_cnt FROM jlwm_future_paths
  WHERE id IS NULL OR office_id IS NULL OR subject_type IS NULL
    OR optimistic IS NULL OR realistic IS NULL OR pessimistic IS NULL
    OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_future_paths has % incompatible NULL row(s)',
      null_cnt;
  END IF;
  ALTER TABLE jlwm_future_paths ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_future_paths ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_future_paths ALTER COLUMN subject_type SET NOT NULL;
  ALTER TABLE jlwm_future_paths ALTER COLUMN optimistic SET NOT NULL;
  ALTER TABLE jlwm_future_paths ALTER COLUMN realistic SET NOT NULL;
  ALTER TABLE jlwm_future_paths ALTER COLUMN pessimistic SET NOT NULL;
  ALTER TABLE jlwm_future_paths ALTER COLUMN created_at SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_simulations
  WHERE id IS NULL OR office_id IS NULL OR case_id IS NULL OR scenario_type IS NULL
    OR scenario_params IS NULL OR outcomes IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_simulations has % incompatible NULL row(s)',
      null_cnt;
  END IF;
  ALTER TABLE jlwm_simulations ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_simulations ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_simulations ALTER COLUMN case_id SET NOT NULL;
  ALTER TABLE jlwm_simulations ALTER COLUMN scenario_type SET NOT NULL;
  ALTER TABLE jlwm_simulations ALTER COLUMN scenario_params SET NOT NULL;
  ALTER TABLE jlwm_simulations ALTER COLUMN outcomes SET NOT NULL;
  ALTER TABLE jlwm_simulations ALTER COLUMN created_at SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_litigation_intel
  WHERE id IS NULL OR office_id IS NULL OR case_id IS NULL
    OR strengths IS NULL OR weaknesses IS NULL OR missing_evidence IS NULL
    OR procedural_risks IS NULL OR recommended_actions IS NULL
    OR overall_score IS NULL OR confidence IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_litigation_intel has % incompatible NULL row(s)',
      null_cnt;
  END IF;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN case_id SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN strengths SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN weaknesses SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN missing_evidence SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN procedural_risks SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN recommended_actions SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN overall_score SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN confidence SET NOT NULL;
  ALTER TABLE jlwm_litigation_intel ALTER COLUMN created_at SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_accuracy_records
  WHERE id IS NULL OR office_id IS NULL OR case_id IS NULL OR prediction_type IS NULL
    OR predicted_value IS NULL OR actual_value IS NULL OR recorded_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_accuracy_records has % incompatible NULL row(s)',
      null_cnt;
  END IF;
  ALTER TABLE jlwm_accuracy_records ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_accuracy_records ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_accuracy_records ALTER COLUMN case_id SET NOT NULL;
  ALTER TABLE jlwm_accuracy_records ALTER COLUMN prediction_type SET NOT NULL;
  ALTER TABLE jlwm_accuracy_records ALTER COLUMN predicted_value SET NOT NULL;
  ALTER TABLE jlwm_accuracy_records ALTER COLUMN actual_value SET NOT NULL;
  ALTER TABLE jlwm_accuracy_records ALTER COLUMN recorded_at SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_executive_reports
  WHERE id IS NULL OR office_id IS NULL OR report_type IS NULL
    OR period_start IS NULL OR period_end IS NULL
    OR kpis IS NULL OR revenue_forecast IS NULL OR risk_concentration IS NULL
    OR lawyer_performance IS NULL OR client_risk IS NULL
    OR opportunities IS NULL OR alerts IS NULL OR generated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_executive_reports has % incompatible NULL row(s)',
      null_cnt;
  END IF;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN report_type SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN period_start SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN period_end SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN kpis SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN revenue_forecast SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN risk_concentration SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN lawyer_performance SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN client_risk SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN opportunities SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN alerts SET NOT NULL;
  ALTER TABLE jlwm_executive_reports ALTER COLUMN generated_at SET NOT NULL;

  /* COO required columns already NULL-blocked above */
  ALTER TABLE jlwm_coo_actions ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN action_type SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN title SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN description SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN priority SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN status SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN target_ref SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN suggested_action SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE jlwm_coo_actions ALTER COLUMN updated_at SET NOT NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PK (id) only — add if missing; block on NULL/dup id or wrong PK
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_future_paths','jlwm_simulations','jlwm_litigation_intel',
    'jlwm_accuracy_records','jlwm_executive_reports','jlwm_coo_actions'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;

    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION
          '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED_IDENTIFIERS) — NULL id blocks PK on %',
          tbl;
      END IF;
      EXECUTE format(
        'SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d',
        tbl
      ) INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_PK) — duplicate id on %',
          tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
          AND pg_get_constraintdef(c.oid) ~* '\(id\)'
          AND pg_get_constraintdef(c.oid) !~* ','
      ) THEN
        RAISE EXCEPTION
          '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)',
          tbl;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes (non-unique). No DROP INDEX.
-- DESC: idx_jer_type last col generated_at; idx_jca_priority last col created_at.
-- Other indexes ASC (no DESC bit). Validate via indoption & 1.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  expected_table_oid OID;
  actual_table_oid OID;
  index_unique BOOLEAN;
  index_partial BOOLEAN;
  index_expression BOOLEAN;
  index_valid BOOLEAN;
  index_ready BOOLEAN;
  index_columns TEXT[];
  index_options INT[];
  last_opt INT;
  i INT;
  desc_ok BOOLEAN;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_jfp_office', 'jlwm_future_paths', ARRAY['office_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jfp_office ON jlwm_future_paths(office_id)'),
      ('idx_jfp_subject', 'jlwm_future_paths', ARRAY['subject_type','subject_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jfp_subject ON jlwm_future_paths(subject_type, subject_id)'),
      ('idx_jsim_office', 'jlwm_simulations', ARRAY['office_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jsim_office ON jlwm_simulations(office_id)'),
      ('idx_jsim_case', 'jlwm_simulations', ARRAY['case_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jsim_case ON jlwm_simulations(case_id)'),
      ('idx_jli_office', 'jlwm_litigation_intel', ARRAY['office_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jli_office ON jlwm_litigation_intel(office_id)'),
      ('idx_jli_case', 'jlwm_litigation_intel', ARRAY['case_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jli_case ON jlwm_litigation_intel(case_id)'),
      ('idx_jac_office', 'jlwm_accuracy_records', ARRAY['office_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jac_office ON jlwm_accuracy_records(office_id)'),
      ('idx_jac_type', 'jlwm_accuracy_records', ARRAY['office_id','prediction_type']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jac_type ON jlwm_accuracy_records(office_id, prediction_type)'),
      ('idx_jac_case', 'jlwm_accuracy_records', ARRAY['office_id','case_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jac_case ON jlwm_accuracy_records(office_id, case_id)'),
      ('idx_jer_office', 'jlwm_executive_reports', ARRAY['office_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jer_office ON jlwm_executive_reports(office_id)'),
      ('idx_jer_type', 'jlwm_executive_reports', ARRAY['office_id','report_type','generated_at']::text[], true,
       'CREATE INDEX IF NOT EXISTS idx_jer_type ON jlwm_executive_reports(office_id, report_type, generated_at DESC)'),
      ('idx_jca_office', 'jlwm_coo_actions', ARRAY['office_id']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jca_office ON jlwm_coo_actions(office_id)'),
      ('idx_jca_status', 'jlwm_coo_actions', ARRAY['office_id','status']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jca_status ON jlwm_coo_actions(office_id, status)'),
      ('idx_jca_type', 'jlwm_coo_actions', ARRAY['office_id','action_type']::text[], false,
       'CREATE INDEX IF NOT EXISTS idx_jca_type ON jlwm_coo_actions(office_id, action_type)'),
      ('idx_jca_priority', 'jlwm_coo_actions', ARRAY['office_id','priority','created_at']::text[], true,
       'CREATE INDEX IF NOT EXISTS idx_jca_priority ON jlwm_coo_actions(office_id, priority, created_at DESC)')
    ) AS t(index_name, table_name, columns, last_desc, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    actual_table_oid := NULL;
    index_unique := NULL;
    index_partial := NULL;
    index_expression := NULL;
    index_valid := NULL;
    index_ready := NULL;
    index_columns := NULL;
    index_options := NULL;

    SELECT
      x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (
        SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS key_column(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid AND a.attnum = key_column.attnum AND NOT a.attisdropped
      ),
      (
        SELECT array_agg(o::int ORDER BY ord.ordinality)
        FROM unnest(x.indoption) WITH ORDINALITY AS ord(o, ordinality)
      )
    INTO actual_table_oid, index_unique, index_partial, index_expression,
         index_valid, index_ready, index_columns, index_options
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    WHERE n.nspname = 'public' AND i.relname = spec.index_name;

    IF NOT FOUND THEN
      EXECUTE spec.create_sql;
    ELSE
      desc_ok := true;
      IF index_options IS NULL
         OR array_length(index_options, 1) IS DISTINCT FROM array_length(spec.columns, 1) THEN
        desc_ok := false;
      ELSIF spec.last_desc THEN
        last_opt := index_options[array_length(index_options, 1)];
        IF (last_opt & 1) IS DISTINCT FROM 1 THEN
          desc_ok := false;
        END IF;
        FOR i IN 1 .. (array_length(index_options, 1) - 1) LOOP
          IF (index_options[i] & 1) IS DISTINCT FROM 0 THEN
            desc_ok := false;
          END IF;
        END LOOP;
      ELSE
        FOR i IN 1 .. array_length(index_options, 1) LOOP
          IF (index_options[i] & 1) IS DISTINCT FROM 0 THEN
            desc_ok := false;
          END IF;
        END LOOP;
      END IF;

      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS TRUE
         OR index_partial IS TRUE
         OR index_expression IS TRUE
         OR index_valid IS NOT TRUE
         OR index_ready IS NOT TRUE
         OR index_columns IS DISTINCT FROM spec.columns
         OR desc_ok IS NOT TRUE THEN
        RAISE EXCEPTION
          '035_jlwm_satellites: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (table=% unique=% partial=% expression=% valid=% ready=% columns=% expected=% opts=% last_desc=%)',
          spec.index_name, actual_table_oid::regclass, index_unique, index_partial,
          index_expression, index_valid, index_ready, index_columns, spec.columns,
          index_options, spec.last_desc;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness (must pass before COMMIT)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
  missing TEXT[] := ARRAY[]::text[];
  actual_udt TEXT;
  has_pk BOOLEAN;
  idx_name TEXT;
  index_ok BOOLEAN;
  index_columns TEXT[];
  index_options INT[];
  last_opt INT;
  desc_ok BOOLEAN;
  opt_i INT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_future_paths','jlwm_simulations','jlwm_litigation_intel',
    'jlwm_accuracy_records','jlwm_executive_reports','jlwm_coo_actions'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      missing := array_append(missing, tbl);
    END IF;
  END LOOP;
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — missing tables: %',
      array_to_string(missing, ', ');
  END IF;

  /* Key column types */
  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_future_paths' AND c.column_name='office_id';
  IF actual_udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — jlwm_future_paths.office_id udt=%', actual_udt;
  END IF;

  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_simulations' AND c.column_name='case_id';
  IF actual_udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — jlwm_simulations.case_id udt=%', actual_udt;
  END IF;

  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_litigation_intel' AND c.column_name='overall_score';
  IF actual_udt IS DISTINCT FROM 'float8' THEN
    RAISE EXCEPTION '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — jlwm_litigation_intel.overall_score udt=%', actual_udt;
  END IF;

  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_accuracy_records' AND c.column_name='predicted_value';
  IF actual_udt IS DISTINCT FROM 'jsonb' THEN
    RAISE EXCEPTION '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — jlwm_accuracy_records.predicted_value udt=%', actual_udt;
  END IF;

  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_executive_reports' AND c.column_name='period_start';
  IF actual_udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — jlwm_executive_reports.period_start udt=%', actual_udt;
  END IF;

  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_coo_actions' AND c.column_name='target_ref';
  IF actual_udt IS DISTINCT FROM 'jsonb' THEN
    RAISE EXCEPTION '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — jlwm_coo_actions.target_ref udt=%', actual_udt;
  END IF;

  /* PKs solely (id) */
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_future_paths','jlwm_simulations','jlwm_litigation_intel',
    'jlwm_accuracy_records','jlwm_executive_reports','jlwm_coo_actions'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) INTO has_pk;
    IF NOT has_pk THEN
      RAISE EXCEPTION
        '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — % PK (id) missing or incompatible',
        tbl;
    END IF;
  END LOOP;

  /* Named indexes present and exact (including DESC bits) */
  FOREACH idx_name IN ARRAY ARRAY[
    'idx_jfp_office','idx_jfp_subject',
    'idx_jsim_office','idx_jsim_case',
    'idx_jli_office','idx_jli_case',
    'idx_jac_office','idx_jac_type','idx_jac_case',
    'idx_jer_office','idx_jer_type',
    'idx_jca_office','idx_jca_status','idx_jca_type','idx_jca_priority'
  ]
  LOOP
    IF to_regclass(format('public.%I', idx_name)) IS NULL THEN
      RAISE EXCEPTION
        '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — required index % missing',
        idx_name;
    END IF;
  END LOOP;

  /* idx_jer_type: (office_id, report_type, generated_at DESC) */
  SELECT
    x.indisvalid AND x.indisready AND NOT x.indisunique
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indrelid = 'public.jlwm_executive_reports'::regclass,
    (
      SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
      FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS key_column(attnum, ordinality)
      LEFT JOIN pg_attribute a
        ON a.attrelid = x.indrelid AND a.attnum = key_column.attnum AND NOT a.attisdropped
    ),
    (
      SELECT array_agg(o::int ORDER BY ord.ordinality)
      FROM unnest(x.indoption) WITH ORDINALITY AS ord(o, ordinality)
    )
  INTO index_ok, index_columns, index_options
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  JOIN pg_index x ON x.indexrelid = i.oid
  WHERE n.nspname = 'public' AND i.relname = 'idx_jer_type';

  /* Mirror apply-time DESC: last DESC + all prefix keys ASC */
  desc_ok := true;
  IF index_options IS NULL
     OR array_length(index_options, 1) IS DISTINCT FROM 3 THEN
    desc_ok := false;
  ELSE
    last_opt := index_options[array_length(index_options, 1)];
    IF (last_opt & 1) IS DISTINCT FROM 1 THEN
      desc_ok := false;
    END IF;
    FOR opt_i IN 1 .. (array_length(index_options, 1) - 1) LOOP
      IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN
        desc_ok := false;
      END IF;
    END LOOP;
  END IF;
  IF index_ok IS NOT TRUE
     OR index_columns IS DISTINCT FROM ARRAY['office_id','report_type','generated_at']::text[]
     OR desc_ok IS NOT TRUE THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — idx_jer_type not exact (ok=% cols=% opts=% desc_ok=%)',
      index_ok, index_columns, index_options, desc_ok;
  END IF;

  /* idx_jca_priority: (office_id, priority, created_at DESC) */
  SELECT
    x.indisvalid AND x.indisready AND NOT x.indisunique
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indrelid = 'public.jlwm_coo_actions'::regclass,
    (
      SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
      FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS key_column(attnum, ordinality)
      LEFT JOIN pg_attribute a
        ON a.attrelid = x.indrelid AND a.attnum = key_column.attnum AND NOT a.attisdropped
    ),
    (
      SELECT array_agg(o::int ORDER BY ord.ordinality)
      FROM unnest(x.indoption) WITH ORDINALITY AS ord(o, ordinality)
    )
  INTO index_ok, index_columns, index_options
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  JOIN pg_index x ON x.indexrelid = i.oid
  WHERE n.nspname = 'public' AND i.relname = 'idx_jca_priority';

  desc_ok := true;
  IF index_options IS NULL
     OR array_length(index_options, 1) IS DISTINCT FROM 3 THEN
    desc_ok := false;
  ELSE
    last_opt := index_options[array_length(index_options, 1)];
    IF (last_opt & 1) IS DISTINCT FROM 1 THEN
      desc_ok := false;
    END IF;
    FOR opt_i IN 1 .. (array_length(index_options, 1) - 1) LOOP
      IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN
        desc_ok := false;
      END IF;
    END LOOP;
  END IF;
  IF index_ok IS NOT TRUE
     OR index_columns IS DISTINCT FROM ARRAY['office_id','priority','created_at']::text[]
     OR desc_ok IS NOT TRUE THEN
    RAISE EXCEPTION
      '035_jlwm_satellites: POST_APPLY_READINESS_FAILED — idx_jca_priority not exact (ok=% cols=% opts=% desc_ok=%)',
      index_ok, index_columns, index_options, desc_ok;
  END IF;

  RAISE NOTICE
    '035_jlwm_satellites: post-apply FULL READY (Stage 4C; 6 satellite tables; PKs (id); 15 indexes exact incl. DESC)';
END $$;

COMMIT;
