-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 032: moyasar_settings + checkout_settings schema authority
-- (Stage 23.4)
--
-- Owns CREATE / column repair / PK / UNIQUE(office_id) for:
--   moyasar_settings
--   checkout_settings
--
-- Former Runtime DDL:
--   ensureGatewaySettingsTables() — modules/financial/payments.ts
--
-- Contract notes:
--   office_id TEXT NOT NULL with NO DEFAULT (app must supply office_id).
--   Legacy rows with office_id='default' are preserved as data (not remapped).
--   Existing DEFAULT 'default' on office_id is dropped only (values unchanged).
--   No FK. No DROP TABLE. No destructive rewrite / auto-merge of duplicates.
--
-- Apply AFTER: … → 031
-- Idempotent / legacy-safe:
--   CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
--   BLOCK on incompatible types, NULL office_id, duplicate office_id,
--     incompatible UNIQUE/PK shapes
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- Do NOT deploy/apply from the PR agent — ops apply out-of-band after preflight.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Fresh CREATE (no office_id DEFAULT 'default') ──────────────────────────
CREATE TABLE IF NOT EXISTS moyasar_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id         TEXT NOT NULL,
  publishable_key   TEXT,
  secret_key        TEXT,
  webhook_secret    TEXT,
  callback_url      TEXT,
  test_mode         BOOLEAN DEFAULT true,
  enabled           BOOLEAN DEFAULT false,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT moyasar_settings_office_id_key UNIQUE (office_id)
);

CREATE TABLE IF NOT EXISTS checkout_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id         TEXT NOT NULL,
  secret_key        TEXT,
  public_key        TEXT,
  webhook_secret    TEXT,
  test_mode         BOOLEAN DEFAULT true,
  enabled           BOOLEAN DEFAULT false,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT checkout_settings_office_id_key UNIQUE (office_id)
);

-- ── Column repair (legacy Runtime tables) ──────────────────────────────────
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS publishable_key TEXT;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS secret_key TEXT;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS callback_url TEXT;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS test_mode BOOLEAN;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS enabled BOOLEAN;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE moyasar_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS secret_key TEXT;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS test_mode BOOLEAN;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS enabled BOOLEAN;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE checkout_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

ALTER TABLE moyasar_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE moyasar_settings ALTER COLUMN test_mode SET DEFAULT true;
ALTER TABLE moyasar_settings ALTER COLUMN enabled SET DEFAULT false;
ALTER TABLE moyasar_settings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE moyasar_settings ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE checkout_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE checkout_settings ALTER COLUMN test_mode SET DEFAULT true;
ALTER TABLE checkout_settings ALTER COLUMN enabled SET DEFAULT false;
ALTER TABLE checkout_settings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE checkout_settings ALTER COLUMN updated_at SET DEFAULT NOW();

-- ── Guards, NOT NULL, DROP DEFAULT, PK/UNIQUE, readiness ────────────────────
DO $$
DECLARE
  udt TEXT;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  has_pk BOOLEAN;
  has_unique BOOLEAN;
  col_default TEXT;
  default_legacy_cnt BIGINT;
BEGIN
  /* ── Type checks ── */
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='id';
  IF udt IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.id udt=%; expected uuid', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='office_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.office_id udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='publishable_key';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.publishable_key udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='secret_key';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.secret_key udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='webhook_secret';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.webhook_secret udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='callback_url';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.callback_url udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='test_mode';
  IF udt IS DISTINCT FROM 'bool' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.test_mode udt=%; expected bool', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='enabled';
  IF udt IS DISTINCT FROM 'bool' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.enabled udt=%; expected bool', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='created_at';
  IF udt IS DISTINCT FROM 'timestamp' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.created_at udt=%; expected timestamp', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='updated_at';
  IF udt IS DISTINCT FROM 'timestamp' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — moyasar_settings.updated_at udt=%; expected timestamp', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='id';
  IF udt IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.id udt=%; expected uuid', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='office_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.office_id udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='secret_key';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.secret_key udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='public_key';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.public_key udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='webhook_secret';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.webhook_secret udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='test_mode';
  IF udt IS DISTINCT FROM 'bool' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.test_mode udt=%; expected bool', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='enabled';
  IF udt IS DISTINCT FROM 'bool' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.enabled udt=%; expected bool', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='created_at';
  IF udt IS DISTINCT FROM 'timestamp' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.created_at udt=%; expected timestamp', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='updated_at';
  IF udt IS DISTINCT FROM 'timestamp' THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — checkout_settings.updated_at udt=%; expected timestamp', udt;
  END IF;

  /* ── NULL office_id BLOCK before NOT NULL ── */
  SELECT COUNT(*) INTO null_cnt FROM moyasar_settings WHERE office_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_OFFICE_ID) — % moyasar_settings row(s) with NULL office_id', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM checkout_settings WHERE office_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_OFFICE_ID) — % checkout_settings row(s) with NULL office_id', null_cnt;
  END IF;

  /* ── Duplicate office_id BLOCK before UNIQUE ── */
  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id FROM moyasar_settings GROUP BY office_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_OFFICE_ID) — % duplicate office_id group(s) on moyasar_settings; no auto-merge', dup_cnt;
  END IF;
  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id FROM checkout_settings GROUP BY office_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_OFFICE_ID) — % duplicate office_id group(s) on checkout_settings; no auto-merge', dup_cnt;
  END IF;

  /* Report legacy 'default' rows (do not block / remap) */
  SELECT COUNT(*) INTO default_legacy_cnt FROM moyasar_settings WHERE office_id = 'default';
  IF default_legacy_cnt > 0 THEN
    RAISE NOTICE '032_gateway: legacy moyasar_settings office_id=''default'' rows=% (preserved; future tenant cleanup)', default_legacy_cnt;
  END IF;
  SELECT COUNT(*) INTO default_legacy_cnt FROM checkout_settings WHERE office_id = 'default';
  IF default_legacy_cnt > 0 THEN
    RAISE NOTICE '032_gateway: legacy checkout_settings office_id=''default'' rows=% (preserved; future tenant cleanup)', default_legacy_cnt;
  END IF;

  /* ── SET NOT NULL office_id (nulls already blocked) ── */
  ALTER TABLE moyasar_settings ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE checkout_settings ALTER COLUMN office_id SET NOT NULL;

  /* ── DROP DEFAULT 'default' on office_id only (values unchanged) ── */
  SELECT c.column_default INTO col_default
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='office_id';
  IF col_default IS NOT NULL THEN
    ALTER TABLE moyasar_settings ALTER COLUMN office_id DROP DEFAULT;
    RAISE NOTICE '032_gateway: dropped moyasar_settings.office_id DEFAULT (was %); row values unchanged', col_default;
  END IF;

  SELECT c.column_default INTO col_default
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='office_id';
  IF col_default IS NOT NULL THEN
    ALTER TABLE checkout_settings ALTER COLUMN office_id DROP DEFAULT;
    RAISE NOTICE '032_gateway: dropped checkout_settings.office_id DEFAULT (was %); row values unchanged', col_default;
  END IF;

  /* ── PKs on id ── */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.moyasar_settings'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM moyasar_settings WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED_IDENTIFIERS) — NULL id blocks PK on moyasar_settings';
    END IF;
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT id FROM moyasar_settings GROUP BY id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_PK) — duplicate id on moyasar_settings';
    END IF;
    ALTER TABLE moyasar_settings ADD CONSTRAINT moyasar_settings_pkey PRIMARY KEY (id);
  ELSE
    /* Ensure PK is on id only */
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.moyasar_settings'::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
        AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
    ) THEN
      RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — moyasar_settings PK is not solely (id)';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.checkout_settings'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM checkout_settings WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED_IDENTIFIERS) — NULL id blocks PK on checkout_settings';
    END IF;
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT id FROM checkout_settings GROUP BY id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_PK) — duplicate id on checkout_settings';
    END IF;
    ALTER TABLE checkout_settings ADD CONSTRAINT checkout_settings_pkey PRIMARY KEY (id);
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.checkout_settings'::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
        AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
    ) THEN
      RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — checkout_settings PK is not solely (id)';
    END IF;
  END IF;

  /* ── Strict UNIQUE(office_id) arbiter ── */
  PERFORM 1; -- placeholder for helper pattern below
END $$;

-- Separate DO for UNIQUE helpers (clarity)
DO $$
DECLARE
  has_unique BOOLEAN;
  wrong_unique BOOLEAN;
BEGIN
  /* moyasar_settings */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.moyasar_settings'::regclass
      AND c.contype IN ('u', 'p')
      AND pg_get_constraintdef(c.oid) ~* '\(office_id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.moyasar_settings'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indnkeyatts = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped AND a.attname = 'office_id'
      )
  ) INTO has_unique;

  /* Wrong same-name or incompatible multi-col unique named office_id key? */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.moyasar_settings'::regclass
      AND c.contype = 'u'
      AND c.conname = 'moyasar_settings_office_id_key'
      AND (
        pg_get_constraintdef(c.oid) !~* '\(office_id\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) INTO wrong_unique;
  IF wrong_unique THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — moyasar_settings_office_id_key exists with wrong shape';
  END IF;

  IF NOT has_unique THEN
    /* Also BLOCK if a unique index named for office_id exists with wrong shape */
    IF EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index x ON x.indrelid = t.oid
      JOIN pg_class i ON i.oid = x.indexrelid
      WHERE n.nspname='public' AND t.relname='moyasar_settings'
        AND i.relname = 'moyasar_settings_office_id_key'
        AND (
          NOT x.indisunique
          OR x.indpred IS NOT NULL
          OR x.indexprs IS NOT NULL
          OR x.indnkeyatts IS DISTINCT FROM 1
          OR NOT EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
              AND NOT a.attisdropped AND a.attname = 'office_id'
          )
        )
    ) THEN
      RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — moyasar_settings unique index wrong shape';
    END IF;
    ALTER TABLE moyasar_settings
      ADD CONSTRAINT moyasar_settings_office_id_key UNIQUE (office_id);
  END IF;

  /* checkout_settings */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.checkout_settings'::regclass
      AND c.contype IN ('u', 'p')
      AND pg_get_constraintdef(c.oid) ~* '\(office_id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.checkout_settings'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indnkeyatts = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped AND a.attname = 'office_id'
      )
  ) INTO has_unique;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.checkout_settings'::regclass
      AND c.contype = 'u'
      AND c.conname = 'checkout_settings_office_id_key'
      AND (
        pg_get_constraintdef(c.oid) !~* '\(office_id\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) INTO wrong_unique;
  IF wrong_unique THEN
    RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — checkout_settings_office_id_key exists with wrong shape';
  END IF;

  IF NOT has_unique THEN
    IF EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index x ON x.indrelid = t.oid
      JOIN pg_class i ON i.oid = x.indexrelid
      WHERE n.nspname='public' AND t.relname='checkout_settings'
        AND i.relname = 'checkout_settings_office_id_key'
        AND (
          NOT x.indisunique
          OR x.indpred IS NOT NULL
          OR x.indexprs IS NOT NULL
          OR x.indnkeyatts IS DISTINCT FROM 1
          OR NOT EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
              AND NOT a.attisdropped AND a.attname = 'office_id'
          )
        )
    ) THEN
      RAISE EXCEPTION '032_gateway: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — checkout_settings unique index wrong shape';
    END IF;
    ALTER TABLE checkout_settings
      ADD CONSTRAINT checkout_settings_office_id_key UNIQUE (office_id);
  END IF;
END $$;

-- ── Post-apply readiness gate ──────────────────────────────────────────────
DO $$
DECLARE
  has_unique BOOLEAN;
  not_null_ok BOOLEAN;
  has_default BOOLEAN;
BEGIN
  IF to_regclass('public.moyasar_settings') IS NULL
     OR to_regclass('public.checkout_settings') IS NULL THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — required table missing';
  END IF;

  /* Required columns/types — moyasar */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='id' AND udt_name='uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='office_id' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='publishable_key' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='secret_key' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='webhook_secret' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='callback_url' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='test_mode' AND udt_name='bool'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='enabled' AND udt_name='bool'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='created_at' AND udt_name='timestamp'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='updated_at' AND udt_name='timestamp'
  ) THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — moyasar_settings required column types missing';
  END IF;

  /* Required columns/types — checkout */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='id' AND udt_name='uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='office_id' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='secret_key' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='public_key' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='webhook_secret' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='test_mode' AND udt_name='bool'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='enabled' AND udt_name='bool'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='created_at' AND udt_name='timestamp'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='updated_at' AND udt_name='timestamp'
  ) THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — checkout_settings required column types missing';
  END IF;

  /* office_id NOT NULL */
  SELECT a.attnotnull INTO not_null_ok
  FROM pg_attribute a
  JOIN pg_class t ON t.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname='public' AND t.relname='moyasar_settings'
    AND a.attname='office_id' AND NOT a.attisdropped;
  IF not_null_ok IS NOT TRUE THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — moyasar_settings.office_id NOT NULL missing';
  END IF;
  SELECT a.attnotnull INTO not_null_ok
  FROM pg_attribute a
  JOIN pg_class t ON t.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname='public' AND t.relname='checkout_settings'
    AND a.attname='office_id' AND NOT a.attisdropped;
  IF not_null_ok IS NOT TRUE THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — checkout_settings.office_id NOT NULL missing';
  END IF;

  /* office_id has NO DEFAULT */
  SELECT (c.column_default IS NOT NULL) INTO has_default
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='office_id';
  IF has_default THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — moyasar_settings.office_id still has a DEFAULT';
  END IF;
  SELECT (c.column_default IS NOT NULL) INTO has_default
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='office_id';
  IF has_default THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — checkout_settings.office_id still has a DEFAULT';
  END IF;

  /* PKs */
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.moyasar_settings'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.checkout_settings'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
  ) THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — required PK(id) missing';
  END IF;

  /* Strict UNIQUE(office_id) */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.moyasar_settings'::regclass
      AND c.contype IN ('u', 'p')
      AND pg_get_constraintdef(c.oid) ~* '\(office_id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.moyasar_settings'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indnkeyatts = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped AND a.attname = 'office_id'
      )
  ) INTO has_unique;
  IF NOT has_unique THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — moyasar_settings UNIQUE(office_id) missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.checkout_settings'::regclass
      AND c.contype IN ('u', 'p')
      AND pg_get_constraintdef(c.oid) ~* '\(office_id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.checkout_settings'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indnkeyatts = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped AND a.attname = 'office_id'
      )
  ) INTO has_unique;
  IF NOT has_unique THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — checkout_settings UNIQUE(office_id) missing';
  END IF;

  /* Expected defaults for test_mode / enabled / timestamps present */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='test_mode' AND column_default ILIKE '%true%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='enabled' AND column_default ILIKE '%false%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='created_at' AND column_default ILIKE '%now()%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='moyasar_settings'
      AND column_name='updated_at' AND column_default ILIKE '%now()%'
  ) THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — moyasar_settings expected defaults missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='test_mode' AND column_default ILIKE '%true%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='enabled' AND column_default ILIKE '%false%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='created_at' AND column_default ILIKE '%now()%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkout_settings'
      AND column_name='updated_at' AND column_default ILIKE '%now()%'
  ) THEN
    RAISE EXCEPTION '032_gateway: POST_APPLY_READINESS_FAILED — checkout_settings expected defaults missing';
  END IF;

  RAISE NOTICE '032_gateway: post-apply readiness gate passed (tables/cols/NOT NULL/no office_id DEFAULT/PK/UNIQUE(office_id)/defaults)';
END $$;

COMMIT;
