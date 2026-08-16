-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 044: AI COO Notif Settings Runtime DDL schema authority (Stage 7)
--
-- Owns the still-executable Runtime DDL from aiCoo.ensureNotifTable:
--   A) ai_coo_notif_settings — per-office notification prefs
--      (+ UNIQUE(office_id) for GET seed ON CONFLICT DO NOTHING and
--       PATCH ON CONFLICT (office_id) DO UPDATE)
--
-- Does NOT CREATE: support AI / orphans / 039–043 objects.
-- No invented FK. No UUID-only office_id enforcement (TEXT business key).
-- No tenant remap/backfill. No DROP/DELETE of legacy rows.
--
-- Idempotent. Fail-closed. Post-apply readiness before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A) ai_coo_notif_settings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_coo_notif_settings (
  id                SERIAL PRIMARY KEY,
  office_id         TEXT NOT NULL UNIQUE,
  telegram_enabled  BOOLEAN DEFAULT false,
  whatsapp_enabled  BOOLEAN DEFAULT false,
  email_enabled     BOOLEAN DEFAULT false,
  min_level         TEXT DEFAULT 'critical',
  email_recipients  TEXT DEFAULT '',
  whatsapp_numbers  TEXT DEFAULT '',
  auto_notify       BOOLEAN DEFAULT false,
  last_notified_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS min_level TEXT;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS email_recipients TEXT;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS whatsapp_numbers TEXT;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS auto_notify BOOLEAN;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE ai_coo_notif_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

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
      ('ai_coo_notif_settings','id','int4'),
      ('ai_coo_notif_settings','office_id','text'),
      ('ai_coo_notif_settings','telegram_enabled','bool'),
      ('ai_coo_notif_settings','whatsapp_enabled','bool'),
      ('ai_coo_notif_settings','email_enabled','bool'),
      ('ai_coo_notif_settings','min_level','text'),
      ('ai_coo_notif_settings','email_recipients','text'),
      ('ai_coo_notif_settings','whatsapp_numbers','text'),
      ('ai_coo_notif_settings','auto_notify','bool'),
      ('ai_coo_notif_settings','last_notified_at','timestamptz'),
      ('ai_coo_notif_settings','created_at','timestamptz'),
      ('ai_coo_notif_settings','updated_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM ai_coo_notif_settings
  WHERE id IS NULL OR office_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — ai_coo_notif_settings has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id FROM ai_coo_notif_settings GROUP BY office_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate office_id group(s) on ai_coo_notif_settings',
      dup_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE ai_coo_notif_settings ALTER COLUMN telegram_enabled SET DEFAULT false;
ALTER TABLE ai_coo_notif_settings ALTER COLUMN whatsapp_enabled SET DEFAULT false;
ALTER TABLE ai_coo_notif_settings ALTER COLUMN email_enabled SET DEFAULT false;
ALTER TABLE ai_coo_notif_settings ALTER COLUMN min_level SET DEFAULT 'critical';
ALTER TABLE ai_coo_notif_settings ALTER COLUMN email_recipients SET DEFAULT '';
ALTER TABLE ai_coo_notif_settings ALTER COLUMN whatsapp_numbers SET DEFAULT '';
ALTER TABLE ai_coo_notif_settings ALTER COLUMN auto_notify SET DEFAULT false;
ALTER TABLE ai_coo_notif_settings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE ai_coo_notif_settings ALTER COLUMN updated_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes (only Runtime-required: id + office_id)
DO $$
BEGIN
  ALTER TABLE ai_coo_notif_settings ALTER COLUMN id SET NOT NULL;
  ALTER TABLE ai_coo_notif_settings ALTER COLUMN office_id SET NOT NULL;
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
    WHERE c.conrelid = 'public.ai_coo_notif_settings'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM ai_coo_notif_settings WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on ai_coo_notif_settings';
    END IF;
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT id FROM ai_coo_notif_settings GROUP BY id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on ai_coo_notif_settings';
    END IF;
    ALTER TABLE ai_coo_notif_settings ADD CONSTRAINT ai_coo_notif_settings_pkey PRIMARY KEY (id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_coo_notif_settings'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — ai_coo_notif_settings PK is not solely (id)';
  END IF;
END $$;

-- ── UNIQUE(office_id) — exact single-column for ON CONFLICT (office_id) ──
DO $$
DECLARE
  has_uq BOOLEAN;
  near_miss_uq BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_coo_notif_settings'::regclass AND c.contype = 'u'
      AND c.conname = 'ai_coo_notif_settings_office_id_key'
      AND (
        pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*office_id\s*\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) THEN
    RAISE EXCEPTION '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — ai_coo_notif_settings_office_id_key wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_coo_notif_settings'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.ai_coo_notif_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id']::text[]
  ) INTO has_uq;

  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.ai_coo_notif_settings'::regclass
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
    RAISE EXCEPTION '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — ai_coo_notif_settings UNIQUE(office_id) index invalid/not-ready/partial/expression';
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
      WHERE x.indrelid = 'public.ai_coo_notif_settings'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND cardinality(c.cols) > 1
        AND ARRAY['office_id']::text[] <@ c.cols
    ) INTO near_miss_uq;
    IF near_miss_uq THEN
      RAISE EXCEPTION '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — ai_coo_notif_settings has wider UNIQUE containing office_id; exact UNIQUE(office_id) required';
    END IF;
  END IF;

  -- Expression UNIQUE on office_id (e.g. lower(office_id)) — no plain cols match,
  -- but indexprs present with office_id involvement → BLOCK (never invent DROP).
  IF NOT has_uq AND EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.ai_coo_notif_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indexprs IS NOT NULL
      AND pg_get_indexdef(x.indexrelid) ~* 'office_id'
  ) THEN
    RAISE EXCEPTION '044_ai_coo_notif_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — ai_coo_notif_settings has expression UNIQUE involving office_id; exact UNIQUE(office_id) required';
  END IF;

  IF NOT has_uq THEN
    ALTER TABLE ai_coo_notif_settings ADD CONSTRAINT ai_coo_notif_settings_office_id_key UNIQUE (office_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness — must pass before COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.ai_coo_notif_settings') IS NULL THEN
    RAISE EXCEPTION '044_ai_coo_notif_settings: POST_APPLY_READINESS_FAILED — missing table ai_coo_notif_settings';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.ai_coo_notif_settings'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '044_ai_coo_notif_settings: POST_APPLY_READINESS_FAILED — ai_coo_notif_settings PK (id) missing or incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.ai_coo_notif_settings'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.ai_coo_notif_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id']::text[]
  ) THEN
    RAISE EXCEPTION '044_ai_coo_notif_settings: POST_APPLY_READINESS_FAILED — ai_coo_notif_settings UNIQUE(office_id) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_coo_notif_settings' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '044_ai_coo_notif_settings: POST_APPLY_READINESS_FAILED — ai_coo_notif_settings.office_id TEXT NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ai_coo_notif_settings' AND column_name='id'
      AND udt_name='int4' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '044_ai_coo_notif_settings: POST_APPLY_READINESS_FAILED — ai_coo_notif_settings.id INTEGER NOT NULL missing';
  END IF;

  RAISE NOTICE '044_ai_coo_notif_settings: post-apply FULL READY (reason=AI_COO_NOTIF_SETTINGS_SCHEMA_READY; UNIQUE(office_id))';
END $$;

COMMIT;
