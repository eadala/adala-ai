-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 036: JLWM Reliability schema authority
--
-- Owns exactly the five reliability tables created by ensureReliabilitySchema
-- in reliabilityEngine.ts.
--
-- Does not own JLWM Core (034) or Satellites (035).
-- No DROP, no invented UNIQUE constraints, no foreign keys.
-- Idempotent and fail-closed. Post-apply readiness must pass before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1) jlwm_ai_audit ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_ai_audit (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id      TEXT NOT NULL,
  user_id        TEXT,
  query_type     TEXT NOT NULL,
  model_used     TEXT NOT NULL,
  prompt_hash    TEXT,
  input_summary  TEXT,
  output_summary TEXT,
  confidence     FLOAT,
  evidence_count INT DEFAULT 0,
  data_quality   FLOAT,
  duration_ms    INT,
  tier           TEXT,
  tokens_est     INT,
  viewed_by      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS query_type TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS prompt_hash TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS input_summary TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS output_summary TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS confidence FLOAT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS evidence_count INT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS data_quality FLOAT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS duration_ms INT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS tokens_est INT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS viewed_by TEXT;
ALTER TABLE jlwm_ai_audit ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── 2) jlwm_trust_scores ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_trust_scores (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id             TEXT NOT NULL,
  trust_score           FLOAT NOT NULL DEFAULT 0,
  prediction_accuracy   FLOAT NOT NULL DEFAULT 0,
  data_quality          FLOAT NOT NULL DEFAULT 0,
  recommendation_success FLOAT NOT NULL DEFAULT 0,
  stability_score       FLOAT NOT NULL DEFAULT 0,
  audit_completeness    FLOAT NOT NULL DEFAULT 0,
  label                 TEXT NOT NULL DEFAULT 'غير محدد',
  breakdown             JSONB NOT NULL DEFAULT '{}',
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS trust_score FLOAT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS prediction_accuracy FLOAT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS data_quality FLOAT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS recommendation_success FLOAT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS stability_score FLOAT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS audit_completeness FLOAT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS breakdown JSONB;
ALTER TABLE jlwm_trust_scores ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ;

-- ── 3) jlwm_recommendation_tracking ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_recommendation_tracking (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id         TEXT NOT NULL,
  recommendation_id TEXT,
  title             TEXT NOT NULL,
  category          TEXT,
  was_applied       BOOLEAN,
  outcome_improved  BOOLEAN,
  risk_reduced      BOOLEAN,
  success_score     FLOAT,
  notes             TEXT,
  applied_at        TIMESTAMPTZ,
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS recommendation_id TEXT;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS was_applied BOOLEAN;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS outcome_improved BOOLEAN;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS risk_reduced BOOLEAN;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS success_score FLOAT;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS measured_at TIMESTAMPTZ;
ALTER TABLE jlwm_recommendation_tracking ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── 4) jlwm_data_quality ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_data_quality (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id       TEXT NOT NULL,
  overall_score   FLOAT NOT NULL DEFAULT 0,
  cases_score     FLOAT NOT NULL DEFAULT 0,
  clients_score   FLOAT NOT NULL DEFAULT 0,
  documents_score FLOAT NOT NULL DEFAULT 0,
  tasks_score     FLOAT NOT NULL DEFAULT 0,
  sessions_score  FLOAT NOT NULL DEFAULT 0,
  breakdown       JSONB NOT NULL DEFAULT '{}',
  issues          JSONB NOT NULL DEFAULT '[]',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS overall_score FLOAT;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS cases_score FLOAT;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS clients_score FLOAT;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS documents_score FLOAT;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS tasks_score FLOAT;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS sessions_score FLOAT;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS breakdown JSONB;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS issues JSONB;
ALTER TABLE jlwm_data_quality ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ;

-- ── 5) jlwm_learning_events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_learning_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id   TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  source_id   TEXT,
  source_type TEXT,
  pattern_key TEXT,
  old_weight  FLOAT,
  new_weight  FLOAT,
  delta       FLOAT,
  evidence    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS pattern_key TEXT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS old_weight FLOAT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS new_weight FLOAT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS delta FLOAT;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS evidence JSONB;
ALTER TABLE jlwm_learning_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation (no coercion), ownership checks, and required NULL blocks
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
      ('jlwm_ai_audit','id','text'), ('jlwm_ai_audit','office_id','text'),
      ('jlwm_ai_audit','user_id','text'), ('jlwm_ai_audit','query_type','text'),
      ('jlwm_ai_audit','model_used','text'), ('jlwm_ai_audit','prompt_hash','text'),
      ('jlwm_ai_audit','input_summary','text'), ('jlwm_ai_audit','output_summary','text'),
      ('jlwm_ai_audit','confidence','float8'), ('jlwm_ai_audit','evidence_count','int4'),
      ('jlwm_ai_audit','data_quality','float8'), ('jlwm_ai_audit','duration_ms','int4'),
      ('jlwm_ai_audit','tier','text'), ('jlwm_ai_audit','tokens_est','int4'),
      ('jlwm_ai_audit','viewed_by','text'), ('jlwm_ai_audit','created_at','timestamptz'),
      ('jlwm_trust_scores','id','text'), ('jlwm_trust_scores','office_id','text'),
      ('jlwm_trust_scores','trust_score','float8'), ('jlwm_trust_scores','prediction_accuracy','float8'),
      ('jlwm_trust_scores','data_quality','float8'), ('jlwm_trust_scores','recommendation_success','float8'),
      ('jlwm_trust_scores','stability_score','float8'), ('jlwm_trust_scores','audit_completeness','float8'),
      ('jlwm_trust_scores','label','text'), ('jlwm_trust_scores','breakdown','jsonb'),
      ('jlwm_trust_scores','computed_at','timestamptz'),
      ('jlwm_recommendation_tracking','id','text'), ('jlwm_recommendation_tracking','office_id','text'),
      ('jlwm_recommendation_tracking','recommendation_id','text'), ('jlwm_recommendation_tracking','title','text'),
      ('jlwm_recommendation_tracking','category','text'), ('jlwm_recommendation_tracking','was_applied','bool'),
      ('jlwm_recommendation_tracking','outcome_improved','bool'), ('jlwm_recommendation_tracking','risk_reduced','bool'),
      ('jlwm_recommendation_tracking','success_score','float8'), ('jlwm_recommendation_tracking','notes','text'),
      ('jlwm_recommendation_tracking','applied_at','timestamptz'), ('jlwm_recommendation_tracking','measured_at','timestamptz'),
      ('jlwm_recommendation_tracking','created_at','timestamptz'),
      ('jlwm_data_quality','id','text'), ('jlwm_data_quality','office_id','text'),
      ('jlwm_data_quality','overall_score','float8'), ('jlwm_data_quality','cases_score','float8'),
      ('jlwm_data_quality','clients_score','float8'), ('jlwm_data_quality','documents_score','float8'),
      ('jlwm_data_quality','tasks_score','float8'), ('jlwm_data_quality','sessions_score','float8'),
      ('jlwm_data_quality','breakdown','jsonb'), ('jlwm_data_quality','issues','jsonb'),
      ('jlwm_data_quality','computed_at','timestamptz'),
      ('jlwm_learning_events','id','text'), ('jlwm_learning_events','office_id','text'),
      ('jlwm_learning_events','event_type','text'), ('jlwm_learning_events','source_id','text'),
      ('jlwm_learning_events','source_type','text'), ('jlwm_learning_events','pattern_key','text'),
      ('jlwm_learning_events','old_weight','float8'), ('jlwm_learning_events','new_weight','float8'),
      ('jlwm_learning_events','delta','float8'), ('jlwm_learning_events','evidence','jsonb'),
      ('jlwm_learning_events','created_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_ai_audit','jlwm_trust_scores','jlwm_recommendation_tracking',
    'jlwm_data_quality','jlwm_learning_events'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE office_id IS NULL', tbl) INTO null_cnt;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION
        '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_OFFICE_ID) — % row(s) with NULL office_id on %',
        null_cnt, tbl;
    END IF;
    EXECUTE format(
      $q$SELECT COUNT(*) FROM %I WHERE office_id IS NOT NULL AND office_id !~ %L$q$,
      tbl, uuid_re
    ) INTO non_uuid_cnt;
    IF non_uuid_cnt > 0 THEN
      RAISE EXCEPTION
        '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=NON_UUID_OFFICE_ID) — % non-UUID office_id row(s) on %',
        non_uuid_cnt, tbl;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_ai_audit
  WHERE id IS NULL OR office_id IS NULL OR query_type IS NULL
    OR model_used IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_ai_audit has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_trust_scores
  WHERE id IS NULL OR office_id IS NULL OR trust_score IS NULL
    OR prediction_accuracy IS NULL OR data_quality IS NULL
    OR recommendation_success IS NULL OR stability_score IS NULL
    OR audit_completeness IS NULL OR label IS NULL OR breakdown IS NULL
    OR computed_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_trust_scores has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_recommendation_tracking
  WHERE id IS NULL OR office_id IS NULL OR title IS NULL
    OR measured_at IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_recommendation_tracking has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_data_quality
  WHERE id IS NULL OR office_id IS NULL OR overall_score IS NULL
    OR cases_score IS NULL OR clients_score IS NULL OR documents_score IS NULL
    OR tasks_score IS NULL OR sessions_score IS NULL OR breakdown IS NULL
    OR issues IS NULL OR computed_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_data_quality has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_learning_events
  WHERE id IS NULL OR office_id IS NULL OR event_type IS NULL
    OR evidence IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_learning_events has % NULL required row(s)', null_cnt;
  END IF;
END $$;

-- Safe defaults: these are exactly the Runtime defaults.
ALTER TABLE jlwm_ai_audit ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_ai_audit ALTER COLUMN evidence_count SET DEFAULT 0;
ALTER TABLE jlwm_ai_audit ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE jlwm_trust_scores ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_trust_scores ALTER COLUMN trust_score SET DEFAULT 0;
ALTER TABLE jlwm_trust_scores ALTER COLUMN prediction_accuracy SET DEFAULT 0;
ALTER TABLE jlwm_trust_scores ALTER COLUMN data_quality SET DEFAULT 0;
ALTER TABLE jlwm_trust_scores ALTER COLUMN recommendation_success SET DEFAULT 0;
ALTER TABLE jlwm_trust_scores ALTER COLUMN stability_score SET DEFAULT 0;
ALTER TABLE jlwm_trust_scores ALTER COLUMN audit_completeness SET DEFAULT 0;
ALTER TABLE jlwm_trust_scores ALTER COLUMN label SET DEFAULT 'غير محدد';
ALTER TABLE jlwm_trust_scores ALTER COLUMN breakdown SET DEFAULT '{}';
ALTER TABLE jlwm_trust_scores ALTER COLUMN computed_at SET DEFAULT NOW();

ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN measured_at SET DEFAULT NOW();
ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE jlwm_data_quality ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_data_quality ALTER COLUMN overall_score SET DEFAULT 0;
ALTER TABLE jlwm_data_quality ALTER COLUMN cases_score SET DEFAULT 0;
ALTER TABLE jlwm_data_quality ALTER COLUMN clients_score SET DEFAULT 0;
ALTER TABLE jlwm_data_quality ALTER COLUMN documents_score SET DEFAULT 0;
ALTER TABLE jlwm_data_quality ALTER COLUMN tasks_score SET DEFAULT 0;
ALTER TABLE jlwm_data_quality ALTER COLUMN sessions_score SET DEFAULT 0;
ALTER TABLE jlwm_data_quality ALTER COLUMN breakdown SET DEFAULT '{}';
ALTER TABLE jlwm_data_quality ALTER COLUMN issues SET DEFAULT '[]';
ALTER TABLE jlwm_data_quality ALTER COLUMN computed_at SET DEFAULT NOW();

ALTER TABLE jlwm_learning_events ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_learning_events ALTER COLUMN evidence SET DEFAULT '{}';
ALTER TABLE jlwm_learning_events ALTER COLUMN created_at SET DEFAULT NOW();

-- Safe SET NOT NULL after all required NULL probes have passed.
DO $$
BEGIN
  ALTER TABLE jlwm_ai_audit ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_ai_audit ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_ai_audit ALTER COLUMN query_type SET NOT NULL;
  ALTER TABLE jlwm_ai_audit ALTER COLUMN model_used SET NOT NULL;
  ALTER TABLE jlwm_ai_audit ALTER COLUMN created_at SET NOT NULL;

  ALTER TABLE jlwm_trust_scores ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN trust_score SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN prediction_accuracy SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN data_quality SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN recommendation_success SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN stability_score SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN audit_completeness SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN label SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN breakdown SET NOT NULL;
  ALTER TABLE jlwm_trust_scores ALTER COLUMN computed_at SET NOT NULL;

  ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN title SET NOT NULL;
  ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN measured_at SET NOT NULL;
  ALTER TABLE jlwm_recommendation_tracking ALTER COLUMN created_at SET NOT NULL;

  ALTER TABLE jlwm_data_quality ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN overall_score SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN cases_score SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN clients_score SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN documents_score SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN tasks_score SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN sessions_score SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN breakdown SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN issues SET NOT NULL;
  ALTER TABLE jlwm_data_quality ALTER COLUMN computed_at SET NOT NULL;

  ALTER TABLE jlwm_learning_events ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_learning_events ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_learning_events ALTER COLUMN event_type SET NOT NULL;
  ALTER TABLE jlwm_learning_events ALTER COLUMN evidence SET NOT NULL;
  ALTER TABLE jlwm_learning_events ALTER COLUMN created_at SET NOT NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PK (id) only — add if absent; block wrong PK, NULL ids, and duplicates
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_ai_audit','jlwm_trust_scores','jlwm_recommendation_tracking',
    'jlwm_data_quality','jlwm_learning_events'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format('SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d', tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes (non-unique); DESC indexes require ASC prefix and DESC final key
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
  desc_ok BOOLEAN;
  opt_i INT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_jaa_office','jlwm_ai_audit',ARRAY['office_id']::text[],false,
       'CREATE INDEX IF NOT EXISTS idx_jaa_office ON jlwm_ai_audit(office_id)'),
      ('idx_jaa_type','jlwm_ai_audit',ARRAY['office_id','query_type','created_at']::text[],true,
       'CREATE INDEX IF NOT EXISTS idx_jaa_type ON jlwm_ai_audit(office_id, query_type, created_at DESC)'),
      ('idx_jts_office','jlwm_trust_scores',ARRAY['office_id','computed_at']::text[],true,
       'CREATE INDEX IF NOT EXISTS idx_jts_office ON jlwm_trust_scores(office_id, computed_at DESC)'),
      ('idx_jrt_office','jlwm_recommendation_tracking',ARRAY['office_id']::text[],false,
       'CREATE INDEX IF NOT EXISTS idx_jrt_office ON jlwm_recommendation_tracking(office_id)'),
      ('idx_jdq_office','jlwm_data_quality',ARRAY['office_id','computed_at']::text[],true,
       'CREATE INDEX IF NOT EXISTS idx_jdq_office ON jlwm_data_quality(office_id, computed_at DESC)'),
      ('idx_jle_office','jlwm_learning_events',ARRAY['office_id','created_at']::text[],true,
       'CREATE INDEX IF NOT EXISTS idx_jle_office ON jlwm_learning_events(office_id, created_at DESC)')
    ) AS t(index_name, table_name, columns, last_desc, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    SELECT x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality))
    INTO actual_table_oid, index_unique, index_partial, index_expression,
      index_valid, index_ready, index_columns, index_options
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=spec.index_name;

    IF NOT FOUND THEN
      EXECUTE spec.create_sql;
    ELSE
      desc_ok := true;
      IF index_options IS NULL
         OR cardinality(index_options) IS DISTINCT FROM cardinality(spec.columns) THEN
        desc_ok := false;
      ELSIF spec.last_desc THEN
        IF (index_options[cardinality(index_options)] & 1) IS DISTINCT FROM 1 THEN
          desc_ok := false;
        END IF;
        FOR opt_i IN 1 .. cardinality(index_options)-1 LOOP
          IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
        END LOOP;
      ELSE
        FOR opt_i IN 1 .. cardinality(index_options) LOOP
          IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
        END LOOP;
      END IF;
      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS TRUE OR index_partial IS TRUE OR index_expression IS TRUE
         OR index_valid IS NOT TRUE OR index_ready IS NOT TRUE
         OR index_columns IS DISTINCT FROM spec.columns OR desc_ok IS NOT TRUE THEN
        RAISE EXCEPTION
          '036_jlwm_reliability: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (table=% cols=% expected=% opts=%)',
          spec.index_name, actual_table_oid, index_columns, spec.columns, index_options;
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
  idx_name TEXT;
  actual_udt TEXT;
  index_ok BOOLEAN;
  index_columns TEXT[];
  index_options INT[];
  desc_ok BOOLEAN;
  i INT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_ai_audit','jlwm_trust_scores','jlwm_recommendation_tracking',
    'jlwm_data_quality','jlwm_learning_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION '036_jlwm_reliability: POST_APPLY_READINESS_FAILED — missing table %', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=format('public.%I',tbl)::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '036_jlwm_reliability: POST_APPLY_READINESS_FAILED — % PK (id) missing or incompatible', tbl;
    END IF;
  END LOOP;

  -- Representative contract type checks across the five tables.
  FOR tbl, idx_name IN
    SELECT * FROM (VALUES
      ('jlwm_ai_audit','office_id'), ('jlwm_trust_scores','breakdown'),
      ('jlwm_recommendation_tracking','was_applied'), ('jlwm_data_quality','computed_at'),
      ('jlwm_learning_events','delta')
    ) AS t(table_name, column_name)
  LOOP
    SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=tbl AND c.column_name=idx_name;
    IF actual_udt IS DISTINCT FROM (CASE tbl
      WHEN 'jlwm_ai_audit' THEN 'text'
      WHEN 'jlwm_trust_scores' THEN 'jsonb'
      WHEN 'jlwm_recommendation_tracking' THEN 'bool'
      WHEN 'jlwm_data_quality' THEN 'timestamptz'
      ELSE 'float8' END) THEN
      RAISE EXCEPTION '036_jlwm_reliability: POST_APPLY_READINESS_FAILED — %.% udt=%', tbl, idx_name, actual_udt;
    END IF;
  END LOOP;

  FOREACH idx_name IN ARRAY ARRAY[
    'idx_jaa_office','idx_jaa_type','idx_jts_office',
    'idx_jrt_office','idx_jdq_office','idx_jle_office'
  ]
  LOOP
    IF to_regclass(format('public.%I',idx_name)) IS NULL THEN
      RAISE EXCEPTION '036_jlwm_reliability: POST_APPLY_READINESS_FAILED — required index % missing', idx_name;
    END IF;
  END LOOP;

  FOR idx_name, tbl IN
    SELECT * FROM (VALUES
      ('idx_jaa_office','jlwm_ai_audit'), ('idx_jaa_type','jlwm_ai_audit'),
      ('idx_jts_office','jlwm_trust_scores'), ('idx_jrt_office','jlwm_recommendation_tracking'),
      ('idx_jdq_office','jlwm_data_quality'), ('idx_jle_office','jlwm_learning_events')
    ) AS t(index_name, table_name)
  LOOP
    SELECT x.indisvalid AND x.indisready AND NOT x.indisunique
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indrelid=format('public.%I',tbl)::regclass,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality))
    INTO index_ok, index_columns, index_options
    FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=idx_name;

    IF idx_name='idx_jaa_office' OR idx_name='idx_jrt_office' THEN
      desc_ok := cardinality(index_options)=1 AND (index_options[1] & 1)=0;
    ELSIF idx_name='idx_jaa_type' THEN
      desc_ok := cardinality(index_options)=3
        AND (index_options[1] & 1)=0 AND (index_options[2] & 1)=0
        AND (index_options[3] & 1)=1;
    ELSE
      desc_ok := cardinality(index_options)=2
        AND (index_options[1] & 1)=0 AND (index_options[2] & 1)=1;
    END IF;
    IF index_ok IS NOT TRUE
       OR index_columns IS DISTINCT FROM (CASE idx_name
         WHEN 'idx_jaa_office' THEN ARRAY['office_id']::text[]
         WHEN 'idx_jaa_type' THEN ARRAY['office_id','query_type','created_at']::text[]
         WHEN 'idx_jts_office' THEN ARRAY['office_id','computed_at']::text[]
         WHEN 'idx_jrt_office' THEN ARRAY['office_id']::text[]
         WHEN 'idx_jdq_office' THEN ARRAY['office_id','computed_at']::text[]
         ELSE ARRAY['office_id','created_at']::text[]
       END)
       OR desc_ok IS NOT TRUE THEN
      RAISE EXCEPTION '036_jlwm_reliability: POST_APPLY_READINESS_FAILED — % index shape invalid (table=% cols=% opts=%)', idx_name, tbl, index_columns, index_options;
    END IF;
  END LOOP;

  RAISE NOTICE '036_jlwm_reliability: post-apply FULL READY (5 tables; PKs (id); 6 indexes exact; 4 DESC indexes exact)';
END $$;

COMMIT;
