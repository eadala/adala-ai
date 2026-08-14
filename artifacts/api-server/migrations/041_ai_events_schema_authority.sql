-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 041: AI Events Runtime DDL schema authority (Stage 7E)
--
-- Owns the still-executable Runtime DDL from aiEvents.ensureTables:
--   A) ai_events — office-scoped autonomous event feed
--   B) ai_events_office_status_idx — (office_id, status, created_at DESC)
--
-- Does NOT CREATE: ai_agents / agent_actions / agent_job_logs /
-- case_ai_insights / ai_coo_notif_settings / support_* / orphan credit
-- session tables / 039–040 objects.
--
-- No invented UNIQUE/FK. Dedupe remains application-level
-- (WHERE NOT EXISTS), not a UNIQUE constraint.
-- office_id is a TEXT business key (no UUID-only enforcement).
-- created_at is TIMESTAMP (without time zone) — exact Runtime contract.
--
-- Idempotent. No DROP TABLE / DROP INDEX. Fail-closed.
-- Post-apply readiness before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A) ai_events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_events (
  id         SERIAL PRIMARY KEY,
  office_id  TEXT NOT NULL,
  type       TEXT NOT NULL,
  severity   TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  body       TEXT,
  payload    JSONB DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE ai_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

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
      ('ai_events','id','int4'),
      ('ai_events','office_id','text'),
      ('ai_events','type','text'),
      ('ai_events','severity','text'),
      ('ai_events','title','text'),
      ('ai_events','body','text'),
      ('ai_events','payload','jsonb'),
      ('ai_events','status','text'),
      ('ai_events','created_at','timestamp')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '041_ai_events: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM ai_events
  WHERE id IS NULL OR office_id IS NULL OR type IS NULL
    OR severity IS NULL OR title IS NULL OR status IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '041_ai_events: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — ai_events has % NULL required row(s)',
      null_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE ai_events ALTER COLUMN severity SET DEFAULT 'info';
ALTER TABLE ai_events ALTER COLUMN payload SET DEFAULT '{}';
ALTER TABLE ai_events ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE ai_events ALTER COLUMN created_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes (exact Runtime NOT NULL set)
DO $$
BEGIN
  ALTER TABLE ai_events ALTER COLUMN id SET NOT NULL;
  ALTER TABLE ai_events ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE ai_events ALTER COLUMN type SET NOT NULL;
  ALTER TABLE ai_events ALTER COLUMN severity SET NOT NULL;
  ALTER TABLE ai_events ALTER COLUMN title SET NOT NULL;
  ALTER TABLE ai_events ALTER COLUMN status SET NOT NULL;
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
    WHERE c.conrelid = 'public.ai_events'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM ai_events WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '041_ai_events: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on ai_events';
    END IF;
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT id FROM ai_events GROUP BY id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION '041_ai_events: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on ai_events';
    END IF;
    ALTER TABLE ai_events ADD CONSTRAINT ai_events_pkey PRIMARY KEY (id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_events'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '041_ai_events: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — ai_events PK is not solely (id)';
  END IF;
END $$;

-- ── B) ai_events_office_status_idx (office_id, status, created_at DESC) ───
-- Global name probe: stolen name on another relation / wrong shape /
-- wrong DESC bits → INCOMPATIBLE_INDEX BLOCK (no DROP INDEX).
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
  expected_table_oid := to_regclass('public.ai_events');

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
  WHERE n.nspname='public' AND i.relname='ai_events_office_status_idx';

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
       OR index_columns IS DISTINCT FROM ARRAY['office_id','status','created_at']::text[]
       OR desc_ok IS NOT TRUE THEN
      RAISE EXCEPTION
        '041_ai_events: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — ai_events_office_status_idx incompatible (table_oid=% expected_oid=% cols=% opts=%). No DROP INDEX.',
        actual_table_oid, expected_table_oid, index_columns, index_options;
    END IF;
    -- Exact match already present — leave alone.
  ELSE
    IF expected_table_oid IS NULL THEN
      RAISE EXCEPTION
        '041_ai_events: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — index ai_events_office_status_idx needs table ai_events';
    END IF;
    CREATE INDEX IF NOT EXISTS ai_events_office_status_idx
      ON ai_events (office_id, status, created_at DESC);
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
BEGIN
  IF to_regclass('public.ai_events') IS NULL THEN
    RAISE EXCEPTION '041_ai_events: POST_APPLY_READINESS_FAILED — missing table ai_events';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.ai_events'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '041_ai_events: POST_APPLY_READINESS_FAILED — ai_events PK (id) missing or incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_events' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '041_ai_events: POST_APPLY_READINESS_FAILED — ai_events.office_id TEXT NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_events' AND column_name='status'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '041_ai_events: POST_APPLY_READINESS_FAILED — ai_events.status TEXT NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_events' AND column_name='created_at'
      AND udt_name='timestamp'
  ) THEN
    RAISE EXCEPTION '041_ai_events: POST_APPLY_READINESS_FAILED — ai_events.created_at TIMESTAMP missing';
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
  WHERE n.nspname='public' AND t.relname='ai_events' AND i.relname='ai_events_office_status_idx'
    AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
    AND x.indisunique IS DISTINCT FROM TRUE;

  IF index_columns IS NULL THEN
    RAISE EXCEPTION '041_ai_events: POST_APPLY_READINESS_FAILED — ai_events_office_status_idx missing or wrong binding';
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

  IF index_columns IS DISTINCT FROM ARRAY['office_id','status','created_at']::text[]
     OR desc_ok IS NOT TRUE THEN
    RAISE EXCEPTION
      '041_ai_events: POST_APPLY_READINESS_FAILED — ai_events_office_status_idx wrong shape (cols=% opts=%)',
      index_columns, index_options;
  END IF;

  RAISE NOTICE '041_ai_events: post-apply FULL READY (reason=AI_EVENTS_SCHEMA_READY; ai_events; ai_events_office_status_idx (office_id, status, created_at DESC))';
END $$;

COMMIT;
