-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 051: office_notification_settings Runtime DDL schema authority
-- (Stage 8)
--
-- Owns former Runtime CREATE from notifications.ts boot IIFE:
--   office_notification_settings
--     + exact UNIQUE(office_id, event_type) for ON CONFLICT upsert
--
-- Contract = proven Runtime CREATE + live DML/readers:
--   INSERT … ON CONFLICT (office_id, event_type) DO UPDATE
--   SELECT … WHERE office_id = $officeId (settings GET + listener)
--
-- updated_at is TIMESTAMP (without time zone) — exact Runtime type.
-- No invented FK. Extra live columns never dropped/rewritten.
-- Idempotent. Fail-closed. No DROP TABLE / DROP INDEX.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS office_notification_settings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id      TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  push_enabled   BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled  BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(office_id, event_type)
);

ALTER TABLE office_notification_settings ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE office_notification_settings ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_notification_settings ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE office_notification_settings ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN;
ALTER TABLE office_notification_settings ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN;
ALTER TABLE office_notification_settings ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN;
ALTER TABLE office_notification_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('office_notification_settings','id','uuid'),
      ('office_notification_settings','office_id','text'),
      ('office_notification_settings','event_type','text'),
      ('office_notification_settings','push_enabled','bool'),
      ('office_notification_settings','in_app_enabled','bool'),
      ('office_notification_settings','email_enabled','bool'),
      ('office_notification_settings','updated_at','timestamp')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name=spec.table_name
      AND c.column_name=spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '051_office_notification_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM office_notification_settings
  WHERE id IS NULL OR office_id IS NULL OR event_type IS NULL
    OR push_enabled IS NULL OR in_app_enabled IS NULL OR email_enabled IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '051_office_notification_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — office_notification_settings has % NULL required row(s)',
      null_cnt;
  END IF;
END $$;

ALTER TABLE office_notification_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE office_notification_settings ALTER COLUMN push_enabled SET DEFAULT true;
ALTER TABLE office_notification_settings ALTER COLUMN in_app_enabled SET DEFAULT true;
ALTER TABLE office_notification_settings ALTER COLUMN email_enabled SET DEFAULT false;
ALTER TABLE office_notification_settings ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE office_notification_settings ALTER COLUMN id SET NOT NULL;
  ALTER TABLE office_notification_settings ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE office_notification_settings ALTER COLUMN event_type SET NOT NULL;
  ALTER TABLE office_notification_settings ALTER COLUMN push_enabled SET NOT NULL;
  ALTER TABLE office_notification_settings ALTER COLUMN in_app_enabled SET NOT NULL;
  ALTER TABLE office_notification_settings ALTER COLUMN email_enabled SET NOT NULL;
END $$;

DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.office_notification_settings'::regclass AND c.contype='p'
  ) INTO has_pk;

  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM office_notification_settings WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION
        '051_office_notification_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK';
    END IF;
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT id FROM office_notification_settings WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION
        '051_office_notification_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK';
    END IF;
    ALTER TABLE office_notification_settings ADD CONSTRAINT office_notification_settings_pkey PRIMARY KEY (id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.office_notification_settings'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION
      '051_office_notification_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — PK is not solely (id)';
  END IF;
END $$;

-- Exact UNIQUE(office_id, event_type) — inspect ALL non-primary uniques
DO $$
DECLARE
  dup_cnt BIGINT;
  uq_rec RECORD;
  approved_unique_found BOOLEAN := FALSE;
  has_incompatible_unique BOOLEAN := FALSE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.office_notification_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (
        x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
        OR x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
      )
  ) THEN
    RAISE EXCEPTION
      '051_office_notification_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — UNIQUE index invalid/not-ready/partial/expression';
  END IF;

  FOR uq_rec IN
    SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
    FROM pg_index x
    CROSS JOIN LATERAL unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
    WHERE x.indrelid='public.office_notification_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisvalid AND x.indisready
    GROUP BY x.indexrelid
  LOOP
    IF uq_rec.cols IS DISTINCT FROM ARRAY['office_id','event_type']::TEXT[] THEN
      has_incompatible_unique := TRUE;
    ELSE
      approved_unique_found := TRUE;
    END IF;
  END LOOP;

  IF has_incompatible_unique THEN
    RAISE EXCEPTION
      '051_office_notification_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — incompatible UNIQUE index(es); require exactly UNIQUE(office_id, event_type)';
  END IF;

  IF NOT approved_unique_found THEN
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT office_id, event_type FROM office_notification_settings
      WHERE office_id IS NOT NULL AND event_type IS NOT NULL
      GROUP BY office_id, event_type HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION
        '051_office_notification_settings: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate (office_id, event_type) group(s)',
        dup_cnt;
    END IF;
    ALTER TABLE office_notification_settings
      ADD CONSTRAINT office_notification_settings_office_id_event_type_key
      UNIQUE (office_id, event_type);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_notification_settings'
      AND column_name='office_id' AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION
      '051_office_notification_settings: POST_APPLY_READINESS_FAILED — office_id TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='office_notification_settings'
      AND column_name='event_type' AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION
      '051_office_notification_settings: POST_APPLY_READINESS_FAILED — event_type TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.office_notification_settings'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*,\s*event_type\s*\)'
      AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,[^)]*,'
  ) THEN
    RAISE EXCEPTION
      '051_office_notification_settings: POST_APPLY_READINESS_FAILED — UNIQUE(office_id, event_type) missing';
  END IF;

  RAISE NOTICE
    '051_office_notification_settings: post-apply FULL READY (reason=OFFICE_NOTIFICATION_SETTINGS_SCHEMA_READY; UNIQUE(office_id, event_type))';
END $$;

COMMIT;
