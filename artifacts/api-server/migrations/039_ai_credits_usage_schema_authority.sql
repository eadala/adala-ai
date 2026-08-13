-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 039: AI Credits + Usage Runtime DDL schema authority (Stage 7B)
--
-- Owns the still-executable Runtime DDL confirmed for Stage 7B:
--   A) aiCredits.ts / aiChat.ts — office_ai_credits (+ UNIQUE(office_id),
--      daily/monthly limit-and-usage columns used by aiChat rate limiting)
--   B) aiCredits.ts / aiChat.ts — ai_credit_transactions (ledger of debits/
--      credits; no UNIQUE/FK invented — append-only log)
--   C) aiChat.ts + aiProviderEngine.ts (merged) — ai_usage_logs (+ exact
--      idx_ai_usage_office / idx_ai_usage_created / idx_ai_usage_case)
--
-- balance DEFAULT decision: office_ai_credits.balance is standardized to
-- DEFAULT 100 (not 0). Both seed INSERTs (aiChat.ts, aiCredits.ts admin
-- route) write balance=100 alongside monthly_allowance=100, and the PATCH
-- /ai/cost/limits upsert also writes balance=100 on insert. The DEFAULT 0
-- found in aiCredits.ts's inline CREATE TABLE is the outlier and is
-- superseded here; no existing row is rewritten (DEFAULT only applies to
-- future inserts that omit the column).
--
-- Does NOT CREATE: usage_logs, ai_tasks, ai_api_keys, ai_provider_config,
-- provider tables, agents, or any other AI Gateway/provider-engine surface.
-- office_id='default' is a deliberate business key (not a UUID tenant id)
-- and is never remapped, deleted, or blocked as NON_UUID by this migration.
--
-- Idempotent. No DROP TABLE. No invented UNIQUE/FK beyond Runtime contracts.
-- Fail-closed. Post-apply readiness must pass before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A) office_ai_credits ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_ai_credits (
  id                SERIAL PRIMARY KEY,
  office_id         TEXT NOT NULL UNIQUE DEFAULT 'default',
  office_name       TEXT NOT NULL DEFAULT 'المكتب الافتراضي',
  balance           INTEGER NOT NULL DEFAULT 100,
  monthly_allowance INTEGER NOT NULL DEFAULT 100,
  auto_renew        BOOLEAN NOT NULL DEFAULT TRUE,
  renew_day         INTEGER NOT NULL DEFAULT 1,
  last_renewed_at   TIMESTAMPTZ,
  daily_limit       INTEGER DEFAULT 50,
  daily_used        INTEGER DEFAULT 0,
  monthly_limit     INTEGER DEFAULT 500,
  monthly_used      INTEGER DEFAULT 0,
  daily_reset_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS office_name TEXT;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS balance INTEGER;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS monthly_allowance INTEGER;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS renew_day INTEGER;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMPTZ;
-- Narrow DML compatibility: aiChat.ts rate limiting reads/writes these but the
-- older Runtime CREATE (aiCredits.ts) never defined them.
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS daily_limit INTEGER;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS daily_used INTEGER;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS monthly_limit INTEGER;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS monthly_used INTEGER;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMPTZ;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE office_ai_credits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── B) ai_credit_transactions ─────────────────────────────────────────────
-- No UNIQUE/FK is part of this table's contract (append-only ledger).
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id          SERIAL PRIMARY KEY,
  office_id   TEXT NOT NULL DEFAULT 'default',
  amount      INTEGER NOT NULL,
  type        TEXT NOT NULL DEFAULT 'usage',
  description TEXT,
  model       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_credit_transactions ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE ai_credit_transactions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE ai_credit_transactions ADD COLUMN IF NOT EXISTS amount INTEGER;
ALTER TABLE ai_credit_transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE ai_credit_transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ai_credit_transactions ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE ai_credit_transactions ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE ai_credit_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── C) ai_usage_logs (merged aiChat.ts CREATE + aiProviderEngine.ts ALTERs) ─
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id            SERIAL PRIMARY KEY,
  office_id     TEXT NOT NULL DEFAULT 'default',
  query_type    TEXT NOT NULL DEFAULT 'custom',
  model_used    TEXT NOT NULL,
  tier          TEXT NOT NULL DEFAULT 'mid',
  cost_points   REAL NOT NULL DEFAULT 1,
  cached        BOOLEAN NOT NULL DEFAULT FALSE,
  response_ms   INTEGER,
  prompt_length INTEGER,
  prompt_text   TEXT,
  response_text TEXT,
  case_id       TEXT,
  cost_sar      NUMERIC(8,6) DEFAULT 0,
  token_count   INTEGER DEFAULT 0,
  policy_used   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS query_type TEXT;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS cost_points REAL;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS cached BOOLEAN;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS response_ms INTEGER;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS prompt_length INTEGER;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS prompt_text TEXT;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS response_text TEXT;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS case_id TEXT;
-- Narrow DML compatibility: aiProviderEngine.ts ALTERs these onto the table
-- created by aiChat.ts's older CREATE (which predates provider-engine cost
-- tracking).
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS cost_sar NUMERIC(8,6);
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS token_count INTEGER;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS policy_used TEXT;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation + NULL required blocks
-- office_id is a business key ('default' by design), never UUID-validated.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('office_ai_credits','id','int4'),
      ('office_ai_credits','office_id','text'),
      ('office_ai_credits','office_name','text'),
      ('office_ai_credits','balance','int4'),
      ('office_ai_credits','monthly_allowance','int4'),
      ('office_ai_credits','auto_renew','bool'),
      ('office_ai_credits','renew_day','int4'),
      ('office_ai_credits','last_renewed_at','timestamptz'),
      ('office_ai_credits','daily_limit','int4'),
      ('office_ai_credits','daily_used','int4'),
      ('office_ai_credits','monthly_limit','int4'),
      ('office_ai_credits','monthly_used','int4'),
      ('office_ai_credits','daily_reset_at','timestamptz'),
      ('office_ai_credits','created_at','timestamptz'),
      ('office_ai_credits','updated_at','timestamptz'),
      ('ai_credit_transactions','id','int4'),
      ('ai_credit_transactions','office_id','text'),
      ('ai_credit_transactions','amount','int4'),
      ('ai_credit_transactions','type','text'),
      ('ai_credit_transactions','description','text'),
      ('ai_credit_transactions','model','text'),
      ('ai_credit_transactions','created_by','text'),
      ('ai_credit_transactions','created_at','timestamptz'),
      ('ai_usage_logs','id','int4'),
      ('ai_usage_logs','office_id','text'),
      ('ai_usage_logs','query_type','text'),
      ('ai_usage_logs','model_used','text'),
      ('ai_usage_logs','tier','text'),
      ('ai_usage_logs','cost_points','float4'),
      ('ai_usage_logs','cached','bool'),
      ('ai_usage_logs','response_ms','int4'),
      ('ai_usage_logs','prompt_length','int4'),
      ('ai_usage_logs','prompt_text','text'),
      ('ai_usage_logs','response_text','text'),
      ('ai_usage_logs','case_id','text'),
      ('ai_usage_logs','cost_sar','numeric'),
      ('ai_usage_logs','token_count','int4'),
      ('ai_usage_logs','policy_used','text'),
      ('ai_usage_logs','created_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM office_ai_credits
  WHERE id IS NULL OR office_id IS NULL OR office_name IS NULL OR balance IS NULL
    OR monthly_allowance IS NULL OR auto_renew IS NULL OR renew_day IS NULL
    OR created_at IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — office_ai_credits has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM ai_credit_transactions
  WHERE id IS NULL OR office_id IS NULL OR amount IS NULL OR type IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — ai_credit_transactions has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM ai_usage_logs
  WHERE id IS NULL OR office_id IS NULL OR query_type IS NULL OR model_used IS NULL
    OR tier IS NULL OR cost_points IS NULL OR cached IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — ai_usage_logs has % NULL required row(s)', null_cnt;
  END IF;

  -- office_id duplicate arbiter probe (blocks before UNIQUE add, see below)
  SELECT COUNT(*) INTO null_cnt FROM (
    SELECT office_id FROM office_ai_credits GROUP BY office_id HAVING COUNT(*) > 1
  ) d;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate office_id group(s) on office_ai_credits', null_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime; balance/monthly_limit standardized per header)
ALTER TABLE office_ai_credits ALTER COLUMN office_id SET DEFAULT 'default';
ALTER TABLE office_ai_credits ALTER COLUMN office_name SET DEFAULT 'المكتب الافتراضي';
ALTER TABLE office_ai_credits ALTER COLUMN balance SET DEFAULT 100;
ALTER TABLE office_ai_credits ALTER COLUMN monthly_allowance SET DEFAULT 100;
ALTER TABLE office_ai_credits ALTER COLUMN auto_renew SET DEFAULT TRUE;
ALTER TABLE office_ai_credits ALTER COLUMN renew_day SET DEFAULT 1;
ALTER TABLE office_ai_credits ALTER COLUMN daily_limit SET DEFAULT 50;
ALTER TABLE office_ai_credits ALTER COLUMN daily_used SET DEFAULT 0;
ALTER TABLE office_ai_credits ALTER COLUMN monthly_limit SET DEFAULT 500;
ALTER TABLE office_ai_credits ALTER COLUMN monthly_used SET DEFAULT 0;
ALTER TABLE office_ai_credits ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE office_ai_credits ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE ai_credit_transactions ALTER COLUMN office_id SET DEFAULT 'default';
ALTER TABLE ai_credit_transactions ALTER COLUMN type SET DEFAULT 'usage';
ALTER TABLE ai_credit_transactions ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE ai_usage_logs ALTER COLUMN office_id SET DEFAULT 'default';
ALTER TABLE ai_usage_logs ALTER COLUMN query_type SET DEFAULT 'custom';
ALTER TABLE ai_usage_logs ALTER COLUMN tier SET DEFAULT 'mid';
ALTER TABLE ai_usage_logs ALTER COLUMN cost_points SET DEFAULT 1;
ALTER TABLE ai_usage_logs ALTER COLUMN cached SET DEFAULT FALSE;
ALTER TABLE ai_usage_logs ALTER COLUMN cost_sar SET DEFAULT 0;
ALTER TABLE ai_usage_logs ALTER COLUMN token_count SET DEFAULT 0;
ALTER TABLE ai_usage_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes above (only the columns the contract
-- requires NOT NULL; daily_limit/daily_used/monthly_limit/monthly_used/
-- daily_reset_at/last_renewed_at/response_ms/etc. stay nullable per Runtime).
DO $$
BEGIN
  ALTER TABLE office_ai_credits ALTER COLUMN id SET NOT NULL;
  ALTER TABLE office_ai_credits ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE office_ai_credits ALTER COLUMN office_name SET NOT NULL;
  ALTER TABLE office_ai_credits ALTER COLUMN balance SET NOT NULL;
  ALTER TABLE office_ai_credits ALTER COLUMN monthly_allowance SET NOT NULL;
  ALTER TABLE office_ai_credits ALTER COLUMN auto_renew SET NOT NULL;
  ALTER TABLE office_ai_credits ALTER COLUMN renew_day SET NOT NULL;
  ALTER TABLE office_ai_credits ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE office_ai_credits ALTER COLUMN updated_at SET NOT NULL;

  ALTER TABLE ai_credit_transactions ALTER COLUMN id SET NOT NULL;
  ALTER TABLE ai_credit_transactions ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE ai_credit_transactions ALTER COLUMN amount SET NOT NULL;
  ALTER TABLE ai_credit_transactions ALTER COLUMN type SET NOT NULL;
  ALTER TABLE ai_credit_transactions ALTER COLUMN created_at SET NOT NULL;

  ALTER TABLE ai_usage_logs ALTER COLUMN id SET NOT NULL;
  ALTER TABLE ai_usage_logs ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE ai_usage_logs ALTER COLUMN query_type SET NOT NULL;
  ALTER TABLE ai_usage_logs ALTER COLUMN model_used SET NOT NULL;
  ALTER TABLE ai_usage_logs ALTER COLUMN tier SET NOT NULL;
  ALTER TABLE ai_usage_logs ALTER COLUMN cost_points SET NOT NULL;
  ALTER TABLE ai_usage_logs ALTER COLUMN cached SET NOT NULL;
  ALTER TABLE ai_usage_logs ALTER COLUMN created_at SET NOT NULL;
END $$;

-- PK (id) repair for all three owned tables
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['office_ai_credits','ai_credit_transactions','ai_usage_logs']
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format('SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d', tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

-- ── office_ai_credits UNIQUE(office_id) arbiter ──────────────────────────
-- Exact single-column UNIQUE only. Same-name wrong shape, wider/near-miss,
-- invalid/not-ready/partial/expression index → BLOCK. Duplicate groups are
-- already fail-closed above. Preserves office_id='default' as a normal row.
DO $$
DECLARE
  has_uq BOOLEAN;
  uq_cols TEXT[];
  near_miss_uq BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.office_ai_credits'::regclass AND c.contype = 'u'
      AND c.conname = 'office_ai_credits_office_id_key'
      AND (
        pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*office_id\s*\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — office_ai_credits_office_id_key wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.office_ai_credits'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.office_ai_credits'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id']::text[]
  ) INTO has_uq;

  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.office_ai_credits'::regclass
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
    RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — office_ai_credits UNIQUE(office_id) index invalid/not-ready/partial/expression';
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
      WHERE x.indrelid = 'public.office_ai_credits'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND cardinality(c.cols) > 1
        AND ARRAY['office_id']::text[] <@ c.cols
    ) INTO near_miss_uq;
    IF near_miss_uq THEN
      RAISE EXCEPTION '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — office_ai_credits has wider UNIQUE containing office_id; exact UNIQUE(office_id) required';
    END IF;
  END IF;

  IF NOT has_uq THEN
    ALTER TABLE office_ai_credits ADD CONSTRAINT office_ai_credits_office_id_key UNIQUE (office_id);
  END IF;
END $$;

-- ── ai_usage_logs indexes (exact form; idx_ai_usage_case is partial) ─────
-- Probe INDEX NAMES globally (037 pattern) before CREATE INDEX IF NOT EXISTS.
-- Stolen name on another relation / wrong shape → INCOMPATIBLE_INDEX BLOCK
-- before any CREATE attempt (do not rely on post-apply as first detection).
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
  index_pred TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_ai_usage_office','ai_usage_logs',ARRAY['office_id']::text[],FALSE,
       'CREATE INDEX IF NOT EXISTS idx_ai_usage_office ON ai_usage_logs(office_id)'),
      ('idx_ai_usage_created','ai_usage_logs',ARRAY['created_at']::text[],FALSE,
       'CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_logs(created_at)'),
      ('idx_ai_usage_case','ai_usage_logs',ARRAY['case_id']::text[],TRUE,
       $c$CREATE INDEX IF NOT EXISTS idx_ai_usage_case ON ai_usage_logs (case_id) WHERE case_id IS NOT NULL$c$)
    ) AS t(index_name, table_name, columns, expect_partial, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));

    SELECT x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      pg_get_expr(x.indpred, x.indrelid)
    INTO actual_table_oid, index_unique, index_partial, index_expression,
      index_valid, index_ready, index_columns, index_pred
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=spec.index_name;

    IF FOUND THEN
      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS DISTINCT FROM FALSE
         OR index_partial IS DISTINCT FROM spec.expect_partial
         OR index_expression IS DISTINCT FROM FALSE
         OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE
         OR index_columns IS DISTINCT FROM spec.columns
         OR (
           spec.expect_partial
           AND COALESCE(index_pred, '') !~* 'case_id[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
         ) THEN
        RAISE EXCEPTION
          '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (table_oid=% expected_oid=% cols=% partial=% pred=%). No DROP INDEX.',
          spec.index_name, actual_table_oid, expected_table_oid, index_columns,
          index_partial, coalesce(index_pred,'<none>');
      END IF;
      -- Exact match already present — leave alone.
    ELSE
      IF expected_table_oid IS NULL THEN
        RAISE EXCEPTION
          '039_ai_credits_usage: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — index % needs table %',
          spec.index_name, spec.table_name;
      END IF;
      EXECUTE spec.create_sql;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness — must pass before COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['office_ai_credits','ai_credit_transactions','ai_usage_logs']
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — missing table %', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=format('public.%I',tbl)::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — % PK (id) missing or incompatible', tbl;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.office_ai_credits'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.office_ai_credits'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id']::text[]
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — office_ai_credits UNIQUE(office_id) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_ai_credits' AND column_name='balance'
      AND udt_name='int4'
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — office_ai_credits.balance INTEGER missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_ai_credits' AND column_name='daily_limit'
      AND udt_name='int4'
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — office_ai_credits.daily_limit INTEGER missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_logs' AND column_name='cost_sar'
      AND udt_name='numeric'
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — ai_usage_logs.cost_sar NUMERIC missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_usage_logs' AND column_name='model_used'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — ai_usage_logs.model_used TEXT NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='ai_usage_logs' AND i.relname='idx_ai_usage_office'
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
         = ARRAY['office_id']::text[]
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — idx_ai_usage_office missing or wrong shape';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='ai_usage_logs' AND i.relname='idx_ai_usage_created'
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
         = ARRAY['created_at']::text[]
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — idx_ai_usage_created missing or wrong shape';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='ai_usage_logs' AND i.relname='idx_ai_usage_case'
      AND x.indisvalid AND x.indisready AND x.indpred IS NOT NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
         = ARRAY['case_id']::text[]
      AND pg_get_expr(x.indpred, x.indrelid) ~* 'case_id[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
  ) THEN
    RAISE EXCEPTION '039_ai_credits_usage: POST_APPLY_READINESS_FAILED — idx_ai_usage_case missing or not partial WHERE case_id IS NOT NULL';
  END IF;

  RAISE NOTICE '039_ai_credits_usage: post-apply FULL READY (reason=AI_CREDITS_USAGE_SCHEMA_READY; 3 tables; office_ai_credits UNIQUE(office_id); 3 ai_usage_logs indexes incl. partial case index)';
END $$;

COMMIT;
