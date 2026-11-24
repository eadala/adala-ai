-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 040: AI Provider Engine Runtime DDL schema authority (Stage 7E)
--
-- Owns the still-executable Runtime DDL from aiProviderEngine.ensureTables:
--   A) ai_provider_config — global provider rows (+ UNIQUE(provider) for
--      seed ON CONFLICT (provider) DO NOTHING)
--   B) office_ai_settings — per-office prefs (+ UNIQUE(office_id) for
--      upsert ON CONFLICT (office_id) DO UPDATE)
--
-- Does NOT CREATE: office_ai_credits / ai_credit_transactions / ai_usage_logs
-- (039), ai_events, agents, support AI, orphan credit/session tables.
-- No invented FK. No UUID-only office_id enforcement (TEXT business key).
--
-- Idempotent. No DROP TABLE. Fail-closed. Post-apply readiness before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A) ai_provider_config ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_provider_config (
  id               SERIAL PRIMARY KEY,
  provider         TEXT NOT NULL UNIQUE,
  label_ar         TEXT NOT NULL DEFAULT '',
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  priority         INTEGER NOT NULL DEFAULT 5,
  cost_per_token   NUMERIC(10,6) NOT NULL DEFAULT 0,
  cost_per_request NUMERIC(8,4)  NOT NULL DEFAULT 0,
  monthly_limit    INTEGER,
  current_usage    INTEGER NOT NULL DEFAULT 0,
  model_name       TEXT NOT NULL DEFAULT '',
  notes            TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS label_ar TEXT;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS enabled BOOLEAN;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS priority INTEGER;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS cost_per_token NUMERIC(10,6);
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS cost_per_request NUMERIC(8,4);
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS monthly_limit INTEGER;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS current_usage INTEGER;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS model_name TEXT;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE ai_provider_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── B) office_ai_settings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_ai_settings (
  id                  SERIAL PRIMARY KEY,
  office_id           TEXT NOT NULL UNIQUE,
  preferred_provider  TEXT NOT NULL DEFAULT 'auto',
  mode                TEXT NOT NULL DEFAULT 'balanced',
  allowed_providers   TEXT[] DEFAULT ARRAY['gemini','claude','openai','deepseek'],
  max_monthly_spend   NUMERIC(8,2),
  smart_routing       BOOLEAN NOT NULL DEFAULT TRUE,
  custom_rules        JSONB DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS preferred_provider TEXT;
ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS mode TEXT;
ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS allowed_providers TEXT[];
ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS max_monthly_spend NUMERIC(8,2);
ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS smart_routing BOOLEAN;
ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS custom_rules JSONB;
ALTER TABLE office_ai_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation + NULL required + duplicate UNIQUE key probes
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('ai_provider_config','id','int4'),
      ('ai_provider_config','provider','text'),
      ('ai_provider_config','label_ar','text'),
      ('ai_provider_config','enabled','bool'),
      ('ai_provider_config','priority','int4'),
      ('ai_provider_config','cost_per_token','numeric'),
      ('ai_provider_config','cost_per_request','numeric'),
      ('ai_provider_config','monthly_limit','int4'),
      ('ai_provider_config','current_usage','int4'),
      ('ai_provider_config','model_name','text'),
      ('ai_provider_config','notes','text'),
      ('ai_provider_config','updated_at','timestamptz'),
      ('office_ai_settings','id','int4'),
      ('office_ai_settings','office_id','text'),
      ('office_ai_settings','preferred_provider','text'),
      ('office_ai_settings','mode','text'),
      ('office_ai_settings','allowed_providers','_text'),
      ('office_ai_settings','max_monthly_spend','numeric'),
      ('office_ai_settings','smart_routing','bool'),
      ('office_ai_settings','custom_rules','jsonb'),
      ('office_ai_settings','updated_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM ai_provider_config
  WHERE id IS NULL OR provider IS NULL OR label_ar IS NULL OR enabled IS NULL
    OR priority IS NULL OR cost_per_token IS NULL OR cost_per_request IS NULL
    OR current_usage IS NULL OR model_name IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — ai_provider_config has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM office_ai_settings
  WHERE id IS NULL OR office_id IS NULL OR preferred_provider IS NULL
    OR mode IS NULL OR smart_routing IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — office_ai_settings has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT provider FROM ai_provider_config GROUP BY provider HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate provider group(s) on ai_provider_config', dup_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id FROM office_ai_settings GROUP BY office_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate office_id group(s) on office_ai_settings', dup_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE ai_provider_config ALTER COLUMN label_ar SET DEFAULT '';
ALTER TABLE ai_provider_config ALTER COLUMN enabled SET DEFAULT TRUE;
ALTER TABLE ai_provider_config ALTER COLUMN priority SET DEFAULT 5;
ALTER TABLE ai_provider_config ALTER COLUMN cost_per_token SET DEFAULT 0;
ALTER TABLE ai_provider_config ALTER COLUMN cost_per_request SET DEFAULT 0;
ALTER TABLE ai_provider_config ALTER COLUMN current_usage SET DEFAULT 0;
ALTER TABLE ai_provider_config ALTER COLUMN model_name SET DEFAULT '';
ALTER TABLE ai_provider_config ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE office_ai_settings ALTER COLUMN preferred_provider SET DEFAULT 'auto';
ALTER TABLE office_ai_settings ALTER COLUMN mode SET DEFAULT 'balanced';
ALTER TABLE office_ai_settings ALTER COLUMN allowed_providers SET DEFAULT ARRAY['gemini','claude','openai','deepseek'];
ALTER TABLE office_ai_settings ALTER COLUMN smart_routing SET DEFAULT TRUE;
ALTER TABLE office_ai_settings ALTER COLUMN custom_rules SET DEFAULT '{}';
ALTER TABLE office_ai_settings ALTER COLUMN updated_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes
DO $$
BEGIN
  ALTER TABLE ai_provider_config ALTER COLUMN id SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN provider SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN label_ar SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN enabled SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN priority SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN cost_per_token SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN cost_per_request SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN current_usage SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN model_name SET NOT NULL;
  ALTER TABLE ai_provider_config ALTER COLUMN updated_at SET NOT NULL;

  ALTER TABLE office_ai_settings ALTER COLUMN id SET NOT NULL;
  ALTER TABLE office_ai_settings ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE office_ai_settings ALTER COLUMN preferred_provider SET NOT NULL;
  ALTER TABLE office_ai_settings ALTER COLUMN mode SET NOT NULL;
  ALTER TABLE office_ai_settings ALTER COLUMN smart_routing SET NOT NULL;
  ALTER TABLE office_ai_settings ALTER COLUMN updated_at SET NOT NULL;
END $$;

-- PK (id) for both owned tables
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ai_provider_config','office_ai_settings']
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format('SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d', tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

-- ── UNIQUE(provider) on ai_provider_config ────────────────────────────────
DO $$
DECLARE
  has_uq BOOLEAN;
  near_miss_uq BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_provider_config'::regclass AND c.contype = 'u'
      AND c.conname = 'ai_provider_config_provider_key'
      AND (
        pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*provider\s*\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) THEN
    RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — ai_provider_config_provider_key wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_provider_config'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*provider\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.ai_provider_config'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['provider']::text[]
  ) INTO has_uq;

  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.ai_provider_config'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['provider']::text[]
      AND (
        x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
        OR x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — ai_provider_config UNIQUE(provider) index invalid/not-ready/partial/expression';
  END IF;

  IF NOT has_uq THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_index x
      CROSS JOIN LATERAL (
        SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
      ) c
      WHERE x.indrelid = 'public.ai_provider_config'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND cardinality(c.cols) > 1
        AND ARRAY['provider']::text[] <@ c.cols
    ) INTO near_miss_uq;
    IF near_miss_uq THEN
      RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — ai_provider_config has wider UNIQUE containing provider; exact UNIQUE(provider) required';
    END IF;
  END IF;

  IF NOT has_uq THEN
    ALTER TABLE ai_provider_config ADD CONSTRAINT ai_provider_config_provider_key UNIQUE (provider);
  END IF;
END $$;

-- ── UNIQUE(office_id) on office_ai_settings ───────────────────────────────
DO $$
DECLARE
  has_uq BOOLEAN;
  near_miss_uq BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.office_ai_settings'::regclass AND c.contype = 'u'
      AND c.conname = 'office_ai_settings_office_id_key'
      AND (
        pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*office_id\s*\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) THEN
    RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — office_ai_settings_office_id_key wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.office_ai_settings'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.office_ai_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id']::text[]
  ) INTO has_uq;

  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.office_ai_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id']::text[]
      AND (
        x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
        OR x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — office_ai_settings UNIQUE(office_id) index invalid/not-ready/partial/expression';
  END IF;

  IF NOT has_uq THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_index x
      CROSS JOIN LATERAL (
        SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
      ) c
      WHERE x.indrelid = 'public.office_ai_settings'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND cardinality(c.cols) > 1
        AND ARRAY['office_id']::text[] <@ c.cols
    ) INTO near_miss_uq;
    IF near_miss_uq THEN
      RAISE EXCEPTION '040_ai_provider_engine: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — office_ai_settings has wider UNIQUE containing office_id; exact UNIQUE(office_id) required';
    END IF;
  END IF;

  IF NOT has_uq THEN
    ALTER TABLE office_ai_settings ADD CONSTRAINT office_ai_settings_office_id_key UNIQUE (office_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness — must pass before COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ai_provider_config','office_ai_settings']
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION '040_ai_provider_engine: POST_APPLY_READINESS_FAILED — missing table %', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=format('public.%I',tbl)::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '040_ai_provider_engine: POST_APPLY_READINESS_FAILED — % PK (id) missing or incompatible', tbl;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.ai_provider_config'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*provider\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.ai_provider_config'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['provider']::text[]
  ) THEN
    RAISE EXCEPTION '040_ai_provider_engine: POST_APPLY_READINESS_FAILED — ai_provider_config UNIQUE(provider) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.office_ai_settings'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.office_ai_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id']::text[]
  ) THEN
    RAISE EXCEPTION '040_ai_provider_engine: POST_APPLY_READINESS_FAILED — office_ai_settings UNIQUE(office_id) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_provider_config' AND column_name='enabled'
      AND udt_name='bool' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '040_ai_provider_engine: POST_APPLY_READINESS_FAILED — ai_provider_config.enabled BOOL NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_ai_settings' AND column_name='preferred_provider'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '040_ai_provider_engine: POST_APPLY_READINESS_FAILED — office_ai_settings.preferred_provider TEXT NOT NULL missing';
  END IF;

  RAISE NOTICE '040_ai_provider_engine: post-apply FULL READY (reason=AI_PROVIDER_ENGINE_SCHEMA_READY; 2 tables; UNIQUE(provider); UNIQUE(office_id))';
END $$;

COMMIT;
