-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 043: Case AI Insights Runtime DDL schema authority (Stage 7)
--
-- Owns the still-executable Runtime DDL from case.ai.ensureAIInsightsTable:
--   A) case_ai_insights — tenant-scoped AI analysis cache
--   B) idx_case_ai_insights_case — (case_id, office_id, created_at DESC)
--
-- Does NOT CREATE: ai_coo_notif_settings / support_* / orphan credit-session
-- tables / 039–042 objects.
--
-- No invented UNIQUE/FK. office_id and case_id are TEXT business keys
-- (no UUID-only enforcement, no tenant remap).
-- id is TEXT PK DEFAULT gen_random_uuid()::text (exact Runtime).
--
-- Idempotent. No DROP TABLE / DROP INDEX. Fail-closed.
-- Post-apply readiness before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── A) case_ai_insights ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_ai_insights (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id     TEXT NOT NULL,
  office_id   TEXT NOT NULL,
  risks       JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  alerts      JSONB DEFAULT '[]',
  auto_tasks  JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE case_ai_insights ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE case_ai_insights ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE case_ai_insights ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE case_ai_insights ADD COLUMN IF NOT EXISTS risks JSONB;
ALTER TABLE case_ai_insights ADD COLUMN IF NOT EXISTS suggestions JSONB;
ALTER TABLE case_ai_insights ADD COLUMN IF NOT EXISTS alerts JSONB;
ALTER TABLE case_ai_insights ADD COLUMN IF NOT EXISTS auto_tasks JSONB;
ALTER TABLE case_ai_insights ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation + NULL required probes
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('case_ai_insights','id','text'),
      ('case_ai_insights','case_id','text'),
      ('case_ai_insights','office_id','text'),
      ('case_ai_insights','risks','jsonb'),
      ('case_ai_insights','suggestions','jsonb'),
      ('case_ai_insights','alerts','jsonb'),
      ('case_ai_insights','auto_tasks','jsonb'),
      ('case_ai_insights','created_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '043_case_ai_insights: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM case_ai_insights
  WHERE id IS NULL OR case_id IS NULL OR office_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '043_case_ai_insights: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — case_ai_insights has % NULL required row(s)',
      null_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE case_ai_insights ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE case_ai_insights ALTER COLUMN risks SET DEFAULT '[]';
ALTER TABLE case_ai_insights ALTER COLUMN suggestions SET DEFAULT '[]';
ALTER TABLE case_ai_insights ALTER COLUMN alerts SET DEFAULT '[]';
ALTER TABLE case_ai_insights ALTER COLUMN auto_tasks SET DEFAULT '[]';
ALTER TABLE case_ai_insights ALTER COLUMN created_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes (exact Runtime NOT NULL set)
DO $$
BEGIN
  ALTER TABLE case_ai_insights ALTER COLUMN id SET NOT NULL;
  ALTER TABLE case_ai_insights ALTER COLUMN case_id SET NOT NULL;
  ALTER TABLE case_ai_insights ALTER COLUMN office_id SET NOT NULL;
END $$;

-- PK (id)
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.case_ai_insights'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM case_ai_insights WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '043_case_ai_insights: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on case_ai_insights';
    END IF;
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT id FROM case_ai_insights GROUP BY id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION '043_case_ai_insights: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on case_ai_insights';
    END IF;
    ALTER TABLE case_ai_insights ADD CONSTRAINT case_ai_insights_pkey PRIMARY KEY (id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.case_ai_insights'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '043_case_ai_insights: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — case_ai_insights PK is not solely (id)';
  END IF;
END $$;

-- ── B) idx_case_ai_insights_case (case_id, office_id, created_at DESC) ─────
-- Global name probe: stolen name / wrong shape / wrong DESC → INCOMPATIBLE_INDEX.
DO $$
DECLARE
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
  expected_table_oid := to_regclass('public.case_ai_insights');

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
  WHERE n.nspname='public' AND i.relname='idx_case_ai_insights_case';

  IF FOUND THEN
    desc_ok := true;
    IF index_options IS NULL
       OR cardinality(index_options) IS DISTINCT FROM 3 THEN
      desc_ok := false;
    ELSE
      -- last key DESC; prefix keys ASC
      IF (index_options[3] & 1) IS DISTINCT FROM 1 THEN
        desc_ok := false;
      END IF;
      FOR opt_i IN 1 .. 2 LOOP
        IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
      END LOOP;
    END IF;

    IF actual_table_oid IS DISTINCT FROM expected_table_oid
       OR index_unique IS DISTINCT FROM FALSE
       OR index_partial IS DISTINCT FROM FALSE
       OR index_expression IS DISTINCT FROM FALSE
       OR index_valid IS DISTINCT FROM TRUE
       OR index_ready IS DISTINCT FROM TRUE
       OR index_columns IS DISTINCT FROM ARRAY['case_id','office_id','created_at']::text[]
       OR desc_ok IS NOT TRUE THEN
      RAISE EXCEPTION
        '043_case_ai_insights: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_case_ai_insights_case incompatible (table_oid=% expected_oid=% cols=% opts=%). No DROP INDEX.',
        actual_table_oid, expected_table_oid, index_columns, index_options;
    END IF;
  ELSE
    IF expected_table_oid IS NULL THEN
      RAISE EXCEPTION
        '043_case_ai_insights: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — index idx_case_ai_insights_case needs table case_ai_insights';
    END IF;
    CREATE INDEX IF NOT EXISTS idx_case_ai_insights_case
      ON case_ai_insights (case_id, office_id, created_at DESC);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness — must pass before COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  index_columns TEXT[];
  index_options INT[];
  desc_ok BOOLEAN;
  opt_i INT;
  id_default TEXT;
BEGIN
  IF to_regclass('public.case_ai_insights') IS NULL THEN
    RAISE EXCEPTION '043_case_ai_insights: POST_APPLY_READINESS_FAILED — missing table case_ai_insights';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.case_ai_insights'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '043_case_ai_insights: POST_APPLY_READINESS_FAILED — case_ai_insights PK (id) missing or incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='case_ai_insights' AND column_name='case_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '043_case_ai_insights: POST_APPLY_READINESS_FAILED — case_ai_insights.case_id TEXT NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='case_ai_insights' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '043_case_ai_insights: POST_APPLY_READINESS_FAILED — case_ai_insights.office_id TEXT NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='case_ai_insights' AND column_name='id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '043_case_ai_insights: POST_APPLY_READINESS_FAILED — case_ai_insights.id TEXT NOT NULL missing';
  END IF;

  SELECT c.column_default INTO id_default
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='case_ai_insights' AND c.column_name='id';
  IF coalesce(id_default,'') NOT ILIKE '%gen_random_uuid%' THEN
    RAISE EXCEPTION
      '043_case_ai_insights: POST_APPLY_READINESS_FAILED — case_ai_insights.id default missing gen_random_uuid (actual=%)',
      coalesce(id_default,'<none>');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='case_ai_insights' AND column_name='created_at'
      AND udt_name='timestamptz'
  ) THEN
    RAISE EXCEPTION '043_case_ai_insights: POST_APPLY_READINESS_FAILED — case_ai_insights.created_at TIMESTAMPTZ missing';
  END IF;

  SELECT
    (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
     FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
     JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
    (SELECT array_agg(o::int ORDER BY k.ordinality)
     FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality))
  INTO index_columns, index_options
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname='public' AND t.relname='case_ai_insights' AND i.relname='idx_case_ai_insights_case'
    AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
    AND x.indisunique IS DISTINCT FROM TRUE;

  IF index_columns IS NULL THEN
    RAISE EXCEPTION '043_case_ai_insights: POST_APPLY_READINESS_FAILED — idx_case_ai_insights_case missing or wrong binding';
  END IF;

  desc_ok := true;
  IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM 3 THEN
    desc_ok := false;
  ELSE
    IF (index_options[3] & 1) IS DISTINCT FROM 1 THEN desc_ok := false; END IF;
    FOR opt_i IN 1 .. 2 LOOP
      IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
    END LOOP;
  END IF;

  IF index_columns IS DISTINCT FROM ARRAY['case_id','office_id','created_at']::text[]
     OR desc_ok IS NOT TRUE THEN
    RAISE EXCEPTION
      '043_case_ai_insights: POST_APPLY_READINESS_FAILED — idx_case_ai_insights_case wrong shape (cols=% opts=%)',
      index_columns, index_options;
  END IF;

  RAISE NOTICE '043_case_ai_insights: post-apply FULL READY (reason=CASE_AI_INSIGHTS_SCHEMA_READY; case_ai_insights; idx_case_ai_insights_case (case_id, office_id, created_at DESC))';
END $$;

COMMIT;
