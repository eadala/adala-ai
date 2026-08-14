-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 042: AI Agents Runtime DDL schema authority (Stage 7)
--
-- Owns the still-executable Runtime DDL from:
--   agentRuntime.ts IIFE  — ai_agents + agent_actions (+ 5-row seed)
--   agentCron.ensureTables — agent_job_logs
--                            + idx_agent_job_logs_created (created_at DESC)
--                            + idx_agent_job_logs_type (agent_type)
--
-- Does NOT CREATE: ai_events (041), case_ai_insights / ai_coo_notif_settings /
-- support_* / orphan credit-session tables / 039–040 objects.
--
-- No invented UNIQUE/FK. agent_actions.agent_id soft-joins ai_agents only.
-- agent_job_logs.office_id remains nullable TEXT (no tenant remap).
-- Seed: 5 ai_agents rows ON CONFLICT (id) DO NOTHING (exact Runtime).
--
-- Idempotent. No DROP TABLE / DROP INDEX. Fail-closed.
-- Post-apply readiness before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A) ai_agents ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_ar     TEXT NOT NULL,
  type        TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'active',
  last_run    TIMESTAMPTZ,
  run_count   INTEGER DEFAULT 0,
  memory      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS last_run TIMESTAMPTZ;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS run_count INTEGER;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS memory JSONB;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── B) agent_actions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_actions (
  id           BIGSERIAL PRIMARY KEY,
  agent_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  decision     TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  payload      JSONB DEFAULT '{}',
  severity     TEXT DEFAULT 'info',
  status       TEXT DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS agent_id TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS decision TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- ── C) agent_job_logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_job_logs (
  id           BIGSERIAL PRIMARY KEY,
  agent_type   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',
  office_id    TEXT,
  summary      TEXT,
  details      JSONB,
  duration_ms  INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS agent_type TEXT;
ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE agent_job_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

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
      ('ai_agents','id','text'),
      ('ai_agents','name','text'),
      ('ai_agents','name_ar','text'),
      ('ai_agents','type','text'),
      ('ai_agents','description','text'),
      ('ai_agents','status','text'),
      ('ai_agents','last_run','timestamptz'),
      ('ai_agents','run_count','int4'),
      ('ai_agents','memory','jsonb'),
      ('ai_agents','created_at','timestamptz'),
      ('agent_actions','id','int8'),
      ('agent_actions','agent_id','text'),
      ('agent_actions','event_type','text'),
      ('agent_actions','decision','text'),
      ('agent_actions','title','text'),
      ('agent_actions','body','text'),
      ('agent_actions','payload','jsonb'),
      ('agent_actions','severity','text'),
      ('agent_actions','status','text'),
      ('agent_actions','created_at','timestamptz'),
      ('agent_actions','resolved_at','timestamptz'),
      ('agent_job_logs','id','int8'),
      ('agent_job_logs','agent_type','text'),
      ('agent_job_logs','status','text'),
      ('agent_job_logs','office_id','text'),
      ('agent_job_logs','summary','text'),
      ('agent_job_logs','details','jsonb'),
      ('agent_job_logs','duration_ms','int4'),
      ('agent_job_logs','created_at','timestamptz'),
      ('agent_job_logs','completed_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM ai_agents
  WHERE id IS NULL OR name IS NULL OR name_ar IS NULL OR type IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — ai_agents has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM agent_actions
  WHERE id IS NULL OR agent_id IS NULL OR event_type IS NULL
    OR decision IS NULL OR title IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — agent_actions has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM agent_job_logs
  WHERE id IS NULL OR agent_type IS NULL OR status IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — agent_job_logs has % NULL required row(s)',
      null_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE ai_agents ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE ai_agents ALTER COLUMN run_count SET DEFAULT 0;
ALTER TABLE ai_agents ALTER COLUMN memory SET DEFAULT '{}';
ALTER TABLE ai_agents ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE agent_actions ALTER COLUMN payload SET DEFAULT '{}';
ALTER TABLE agent_actions ALTER COLUMN severity SET DEFAULT 'info';
ALTER TABLE agent_actions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE agent_actions ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE agent_job_logs ALTER COLUMN status SET DEFAULT 'running';
ALTER TABLE agent_job_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes (exact Runtime NOT NULL set)
DO $$
BEGIN
  ALTER TABLE ai_agents ALTER COLUMN id SET NOT NULL;
  ALTER TABLE ai_agents ALTER COLUMN name SET NOT NULL;
  ALTER TABLE ai_agents ALTER COLUMN name_ar SET NOT NULL;
  ALTER TABLE ai_agents ALTER COLUMN type SET NOT NULL;

  ALTER TABLE agent_actions ALTER COLUMN id SET NOT NULL;
  ALTER TABLE agent_actions ALTER COLUMN agent_id SET NOT NULL;
  ALTER TABLE agent_actions ALTER COLUMN event_type SET NOT NULL;
  ALTER TABLE agent_actions ALTER COLUMN decision SET NOT NULL;
  ALTER TABLE agent_actions ALTER COLUMN title SET NOT NULL;

  ALTER TABLE agent_job_logs ALTER COLUMN id SET NOT NULL;
  ALTER TABLE agent_job_logs ALTER COLUMN agent_type SET NOT NULL;
  ALTER TABLE agent_job_logs ALTER COLUMN status SET NOT NULL;
  -- office_id intentionally remains nullable
END $$;

-- PK probes (id) for all three tables
DO $$
DECLARE
  tbl TEXT;
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ai_agents','agent_actions','agent_job_logs']::TEXT[] LOOP
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM pg_constraint c
         WHERE c.conrelid = %L::regclass AND c.contype = %L
       )', 'public.' || tbl, 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION
          '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %',
          tbl;
      END IF;
      EXECUTE format(
        'SELECT COUNT(*) FROM (SELECT id FROM public.%I GROUP BY id HAVING COUNT(*) > 1) d',
        tbl
      ) INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %',
          tbl;
      END IF;
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', tbl)) AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION
        '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)',
        tbl;
    END IF;
  END LOOP;
END $$;

-- ── Seed ai_agents (exact Runtime 5 rows) ─────────────────────────────────
INSERT INTO ai_agents (id, name, name_ar, type, description) VALUES
  ('legal',   'Legal Agent',   'الوكيل القانوني', 'legal',   'يراقب القضايا والمواعيد والمستندات القانونية'),
  ('finance', 'Finance Agent', 'الوكيل المالي',   'finance', 'يراقب الفواتير والتدفق المالي والتحصيل'),
  ('risk',    'Risk Agent',    'وكيل المخاطر',    'risk',    'يحسب درجة المخاطرة ويكتشف الأنماط غير الطبيعية'),
  ('system',  'System Agent',  'وكيل النظام',     'system',  'يراقب أداء المنصة والأخطاء والموارد'),
  ('hr',      'HR Agent',      'وكيل الموارد البشرية', 'hr', 'يراقب الأداء والحضور وتوزيع المهام')
ON CONFLICT (id) DO NOTHING;

-- ── D) idx_agent_job_logs_created (created_at DESC) ───────────────────────
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
BEGIN
  expected_table_oid := to_regclass('public.agent_job_logs');

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
  WHERE n.nspname='public' AND i.relname='idx_agent_job_logs_created';

  IF FOUND THEN
    desc_ok := true;
    IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM 1 THEN
      desc_ok := false;
    ELSIF (index_options[1] & 1) IS DISTINCT FROM 1 THEN
      desc_ok := false;
    END IF;

    IF actual_table_oid IS DISTINCT FROM expected_table_oid
       OR index_unique IS DISTINCT FROM FALSE
       OR index_partial IS DISTINCT FROM FALSE
       OR index_expression IS DISTINCT FROM FALSE
       OR index_valid IS DISTINCT FROM TRUE
       OR index_ready IS DISTINCT FROM TRUE
       OR index_columns IS DISTINCT FROM ARRAY['created_at']::text[]
       OR desc_ok IS NOT TRUE THEN
      RAISE EXCEPTION
        '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_agent_job_logs_created incompatible (table_oid=% expected_oid=% cols=% opts=%). No DROP INDEX.',
        actual_table_oid, expected_table_oid, index_columns, index_options;
    END IF;
  ELSE
    IF expected_table_oid IS NULL THEN
      RAISE EXCEPTION
        '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — index idx_agent_job_logs_created needs table agent_job_logs';
    END IF;
    CREATE INDEX IF NOT EXISTS idx_agent_job_logs_created
      ON agent_job_logs (created_at DESC);
  END IF;
END $$;

-- ── E) idx_agent_job_logs_type (agent_type) ───────────────────────────────
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
  asc_ok BOOLEAN;
  opt_i INT;
BEGIN
  expected_table_oid := to_regclass('public.agent_job_logs');

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
  WHERE n.nspname='public' AND i.relname='idx_agent_job_logs_type';

  IF FOUND THEN
    asc_ok := true;
    IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM 1 THEN
      asc_ok := false;
    ELSE
      FOR opt_i IN 1 .. cardinality(index_options) LOOP
        IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN asc_ok := false; END IF;
      END LOOP;
    END IF;

    IF actual_table_oid IS DISTINCT FROM expected_table_oid
       OR index_unique IS DISTINCT FROM FALSE
       OR index_partial IS DISTINCT FROM FALSE
       OR index_expression IS DISTINCT FROM FALSE
       OR index_valid IS DISTINCT FROM TRUE
       OR index_ready IS DISTINCT FROM TRUE
       OR index_columns IS DISTINCT FROM ARRAY['agent_type']::text[]
       OR asc_ok IS NOT TRUE THEN
      RAISE EXCEPTION
        '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_agent_job_logs_type incompatible (table_oid=% expected_oid=% cols=% opts=%). No DROP INDEX.',
        actual_table_oid, expected_table_oid, index_columns, index_options;
    END IF;
  ELSE
    IF expected_table_oid IS NULL THEN
      RAISE EXCEPTION
        '042_ai_agents: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — index idx_agent_job_logs_type needs table agent_job_logs';
    END IF;
    CREATE INDEX IF NOT EXISTS idx_agent_job_logs_type
      ON agent_job_logs (agent_type);
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
  seed_cnt BIGINT;
BEGIN
  IF to_regclass('public.ai_agents') IS NULL THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — missing table ai_agents';
  END IF;
  IF to_regclass('public.agent_actions') IS NULL THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — missing table agent_actions';
  END IF;
  IF to_regclass('public.agent_job_logs') IS NULL THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — missing table agent_job_logs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.ai_agents'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — ai_agents PK (id) missing or incompatible';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.agent_actions'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — agent_actions PK (id) missing or incompatible';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.agent_job_logs'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — agent_job_logs PK (id) missing or incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_agents' AND column_name='id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — ai_agents.id TEXT NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agent_job_logs' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — agent_job_logs.office_id must remain nullable TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agent_job_logs' AND column_name='created_at'
      AND udt_name='timestamptz'
  ) THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — agent_job_logs.created_at TIMESTAMPTZ missing';
  END IF;

  SELECT COUNT(*) INTO seed_cnt FROM ai_agents
  WHERE id IN ('legal','finance','risk','system','hr');
  IF seed_cnt < 5 THEN
    RAISE EXCEPTION
      '042_ai_agents: POST_APPLY_READINESS_FAILED — ai_agents seed incomplete (found % of 5)',
      seed_cnt;
  END IF;

  -- idx_agent_job_logs_created DESC check
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
  WHERE n.nspname='public' AND t.relname='agent_job_logs' AND i.relname='idx_agent_job_logs_created'
    AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
    AND x.indisunique IS DISTINCT FROM TRUE;

  IF index_columns IS NULL THEN
    RAISE EXCEPTION '042_ai_agents: POST_APPLY_READINESS_FAILED — idx_agent_job_logs_created missing or wrong binding';
  END IF;
  desc_ok := true;
  IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM 1 THEN
    desc_ok := false;
  ELSIF (index_options[1] & 1) IS DISTINCT FROM 1 THEN
    desc_ok := false;
  END IF;
  IF index_columns IS DISTINCT FROM ARRAY['created_at']::text[] OR desc_ok IS NOT TRUE THEN
    RAISE EXCEPTION
      '042_ai_agents: POST_APPLY_READINESS_FAILED — idx_agent_job_logs_created wrong shape (cols=% opts=%)',
      index_columns, index_options;
  END IF;

  -- idx_agent_job_logs_type
  SELECT
    (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
     FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
     JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO index_columns
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname='public' AND t.relname='agent_job_logs' AND i.relname='idx_agent_job_logs_type'
    AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
    AND x.indisunique IS DISTINCT FROM TRUE;

  IF index_columns IS DISTINCT FROM ARRAY['agent_type']::text[] THEN
    RAISE EXCEPTION
      '042_ai_agents: POST_APPLY_READINESS_FAILED — idx_agent_job_logs_type missing or wrong shape (cols=%)',
      index_columns;
  END IF;

  RAISE NOTICE '042_ai_agents: post-apply FULL READY (reason=AI_AGENTS_SCHEMA_READY; ai_agents+seed; agent_actions; agent_job_logs; idx_agent_job_logs_created (created_at DESC); idx_agent_job_logs_type)';
END $$;

COMMIT;
