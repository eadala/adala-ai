-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 045: Support AI Runtime DDL schema authority (Stage 7)
--
-- Owns the still-executable Runtime CREATE from support-ai.ensureSupportAITables:
--   A) support_ai_analysis — ticket-scoped AI analysis
--      (+ UNIQUE(ticket_id) for ON CONFLICT (ticket_id) DO UPDATE)
--   B) support_knowledge_base — global KB (PK only; no invented business UNIQUE)
--
-- Does NOT CREATE / ALTER: support_tickets.ai_score, Enterprise support
-- satellites/indexes, orphans, 039–044 objects.
-- No invented FK. No office_id invent. No KB business UNIQUE.
-- No DELETE/merge of duplicate KB seed rows.
--
-- Idempotent. Fail-closed. Post-apply readiness before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── A) support_ai_analysis ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_ai_analysis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       TEXT NOT NULL UNIQUE,
  ai_type         TEXT,
  ai_priority     TEXT,
  ai_root_cause   TEXT,
  ai_confidence   NUMERIC(4,2) DEFAULT 0,
  ai_suggestions  JSONB DEFAULT '[]',
  ai_summary      TEXT,
  ai_auto_replied BOOLEAN DEFAULT false,
  ai_escalated    BOOLEAN DEFAULT false,
  soc_alerted     BOOLEAN DEFAULT false,
  knowledge_hits  JSONB DEFAULT '[]',
  model_used      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ai_type TEXT;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ai_priority TEXT;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ai_root_cause TEXT;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,2);
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ai_suggestions JSONB;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ai_auto_replied BOOLEAN;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS ai_escalated BOOLEAN;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS soc_alerted BOOLEAN;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS knowledge_hits JSONB;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE support_ai_analysis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── B) support_knowledge_base ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_knowledge_base (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  issue       TEXT NOT NULL,
  fix         TEXT NOT NULL,
  tags        TEXT[] DEFAULT '{}',
  hits        INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_knowledge_base ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE support_knowledge_base ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE support_knowledge_base ADD COLUMN IF NOT EXISTS issue TEXT;
ALTER TABLE support_knowledge_base ADD COLUMN IF NOT EXISTS fix TEXT;
ALTER TABLE support_knowledge_base ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE support_knowledge_base ADD COLUMN IF NOT EXISTS hits INTEGER;
ALTER TABLE support_knowledge_base ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

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
      ('support_ai_analysis','id','uuid'),
      ('support_ai_analysis','ticket_id','text'),
      ('support_ai_analysis','ai_type','text'),
      ('support_ai_analysis','ai_priority','text'),
      ('support_ai_analysis','ai_root_cause','text'),
      ('support_ai_analysis','ai_confidence','numeric'),
      ('support_ai_analysis','ai_suggestions','jsonb'),
      ('support_ai_analysis','ai_summary','text'),
      ('support_ai_analysis','ai_auto_replied','bool'),
      ('support_ai_analysis','ai_escalated','bool'),
      ('support_ai_analysis','soc_alerted','bool'),
      ('support_ai_analysis','knowledge_hits','jsonb'),
      ('support_ai_analysis','model_used','text'),
      ('support_ai_analysis','created_at','timestamptz'),
      ('support_ai_analysis','updated_at','timestamptz'),
      ('support_knowledge_base','id','uuid'),
      ('support_knowledge_base','category','text'),
      ('support_knowledge_base','issue','text'),
      ('support_knowledge_base','fix','text'),
      ('support_knowledge_base','tags','_text'),
      ('support_knowledge_base','hits','int4'),
      ('support_knowledge_base','created_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM support_ai_analysis
  WHERE id IS NULL OR ticket_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — support_ai_analysis has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM support_knowledge_base
  WHERE id IS NULL OR category IS NULL OR issue IS NULL OR fix IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — support_knowledge_base has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT ticket_id FROM support_ai_analysis GROUP BY ticket_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate ticket_id group(s) on support_ai_analysis',
      dup_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE support_ai_analysis ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE support_ai_analysis ALTER COLUMN ai_confidence SET DEFAULT 0;
ALTER TABLE support_ai_analysis ALTER COLUMN ai_suggestions SET DEFAULT '[]';
ALTER TABLE support_ai_analysis ALTER COLUMN ai_auto_replied SET DEFAULT false;
ALTER TABLE support_ai_analysis ALTER COLUMN ai_escalated SET DEFAULT false;
ALTER TABLE support_ai_analysis ALTER COLUMN soc_alerted SET DEFAULT false;
ALTER TABLE support_ai_analysis ALTER COLUMN knowledge_hits SET DEFAULT '[]';
ALTER TABLE support_ai_analysis ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE support_ai_analysis ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE support_knowledge_base ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE support_knowledge_base ALTER COLUMN tags SET DEFAULT '{}';
ALTER TABLE support_knowledge_base ALTER COLUMN hits SET DEFAULT 0;
ALTER TABLE support_knowledge_base ALTER COLUMN created_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes
DO $$
BEGIN
  ALTER TABLE support_ai_analysis ALTER COLUMN id SET NOT NULL;
  ALTER TABLE support_ai_analysis ALTER COLUMN ticket_id SET NOT NULL;
  ALTER TABLE support_knowledge_base ALTER COLUMN id SET NOT NULL;
  ALTER TABLE support_knowledge_base ALTER COLUMN category SET NOT NULL;
  ALTER TABLE support_knowledge_base ALTER COLUMN issue SET NOT NULL;
  ALTER TABLE support_knowledge_base ALTER COLUMN fix SET NOT NULL;
END $$;

-- PK (id) for both owned tables
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['support_ai_analysis','support_knowledge_base']
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format('SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d', tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

-- ── UNIQUE(ticket_id) on support_ai_analysis ──────────────────────────────
DO $$
DECLARE
  has_uq BOOLEAN;
  near_miss_uq BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.support_ai_analysis'::regclass AND c.contype = 'u'
      AND c.conname = 'support_ai_analysis_ticket_id_key'
      AND (
        pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*ticket_id\s*\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) THEN
    RAISE EXCEPTION '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — support_ai_analysis_ticket_id_key wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.support_ai_analysis'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*ticket_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.support_ai_analysis'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['ticket_id']::text[]
  ) INTO has_uq;

  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.support_ai_analysis'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['ticket_id']::text[]
      AND (
        x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
        OR x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — support_ai_analysis UNIQUE(ticket_id) index invalid/not-ready/partial/expression';
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
      WHERE x.indrelid = 'public.support_ai_analysis'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND cardinality(c.cols) > 1
        AND ARRAY['ticket_id']::text[] <@ c.cols
    ) INTO near_miss_uq;
    IF near_miss_uq THEN
      RAISE EXCEPTION '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — support_ai_analysis has wider UNIQUE containing ticket_id; exact UNIQUE(ticket_id) required';
    END IF;
  END IF;

  IF NOT has_uq AND EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.support_ai_analysis'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indexprs IS NOT NULL
      AND pg_get_indexdef(x.indexrelid) ~* 'ticket_id'
  ) THEN
    RAISE EXCEPTION '045_support_ai: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — support_ai_analysis has expression UNIQUE involving ticket_id; exact UNIQUE(ticket_id) required';
  END IF;

  IF NOT has_uq THEN
    ALTER TABLE support_ai_analysis ADD CONSTRAINT support_ai_analysis_ticket_id_key UNIQUE (ticket_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness — must pass before COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['support_ai_analysis','support_knowledge_base']
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION '045_support_ai: POST_APPLY_READINESS_FAILED — missing table %', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=format('public.%I',tbl)::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '045_support_ai: POST_APPLY_READINESS_FAILED — % PK (id) missing or incompatible', tbl;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.support_ai_analysis'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*ticket_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.support_ai_analysis'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['ticket_id']::text[]
  ) THEN
    RAISE EXCEPTION '045_support_ai: POST_APPLY_READINESS_FAILED — support_ai_analysis UNIQUE(ticket_id) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_ai_analysis' AND column_name='ticket_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '045_support_ai: POST_APPLY_READINESS_FAILED — support_ai_analysis.ticket_id TEXT NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_knowledge_base' AND column_name='category'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '045_support_ai: POST_APPLY_READINESS_FAILED — support_knowledge_base.category TEXT NOT NULL missing';
  END IF;

  RAISE NOTICE '045_support_ai: post-apply FULL READY (reason=SUPPORT_AI_SCHEMA_READY; support_ai_analysis UNIQUE(ticket_id); support_knowledge_base PK-only)';
END $$;

COMMIT;
