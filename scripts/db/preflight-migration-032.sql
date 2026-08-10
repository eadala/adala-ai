-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 032 — READ-ONLY checks for gateway settings schema
--
-- Does not CREATE / ALTER / DROP durable objects.
-- Run before applying 032_gateway_settings_schema_authority.sql.
--
-- Decision ladder:
--   1. Inspect existing tables/columns/defaults/constraints/data
--   2. BLOCK_AND_MANUAL_REVIEW for blockers
--   3. SAFE_AUTO_REPAIR for missing/safe gaps (incl. DROP DEFAULT on office_id)
--   4. ALREADY_CORRECT only when full contract matches
--
-- Legacy office_id='default' rows are reported but do NOT block.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 032 preflight: table presence'
SELECT
  to_regclass('public.moyasar_settings') IS NOT NULL AS moyasar_settings_present,
  to_regclass('public.checkout_settings') IS NOT NULL AS checkout_settings_present;

\echo '▶ 032 preflight: moyasar_settings columns'
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'moyasar_settings'
ORDER BY ordinal_position;

\echo '▶ 032 preflight: checkout_settings columns'
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'checkout_settings'
ORDER BY ordinal_position;

\echo '▶ 032 preflight: expected column types'
SELECT
  e.table_name, e.column_name, c.udt_name AS actual_udt, e.expected_udt,
  CASE
    WHEN c.udt_name IS NULL THEN 'missing_column'
    WHEN c.udt_name IS DISTINCT FROM e.expected_udt THEN 'differs_from_expected'
    ELSE 'ok'
  END AS status
FROM (
  VALUES
    ('moyasar_settings', 'id', 'uuid'),
    ('moyasar_settings', 'office_id', 'text'),
    ('moyasar_settings', 'publishable_key', 'text'),
    ('moyasar_settings', 'secret_key', 'text'),
    ('moyasar_settings', 'webhook_secret', 'text'),
    ('moyasar_settings', 'callback_url', 'text'),
    ('moyasar_settings', 'test_mode', 'bool'),
    ('moyasar_settings', 'enabled', 'bool'),
    ('moyasar_settings', 'created_at', 'timestamp'),
    ('moyasar_settings', 'updated_at', 'timestamp'),
    ('checkout_settings', 'id', 'uuid'),
    ('checkout_settings', 'office_id', 'text'),
    ('checkout_settings', 'secret_key', 'text'),
    ('checkout_settings', 'public_key', 'text'),
    ('checkout_settings', 'webhook_secret', 'text'),
    ('checkout_settings', 'test_mode', 'bool'),
    ('checkout_settings', 'enabled', 'bool'),
    ('checkout_settings', 'created_at', 'timestamp'),
    ('checkout_settings', 'updated_at', 'timestamp')
) AS e(table_name, column_name, expected_udt)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
ORDER BY e.table_name, e.column_name;

\echo '▶ 032 preflight: PK / UNIQUE / nulls / dups / legacy default / chosen_action'
DO $$
DECLARE
  ms_present BOOLEAN := to_regclass('public.moyasar_settings') IS NOT NULL;
  cs_present BOOLEAN := to_regclass('public.checkout_settings') IS NOT NULL;

  incompatible_type TEXT := NULL;
  missing_col TEXT := NULL;
  null_office BIGINT := 0;
  dup_office BIGINT := 0;
  legacy_default BIGINT := 0;
  office_has_default BOOLEAN := false;
  office_nullable BOOLEAN := false;

  has_pk_ms BOOLEAN := false;
  has_pk_cs BOOLEAN := false;
  has_unique_ms BOOLEAN := false;
  has_unique_cs BOOLEAN := false;
  incompatible_unique TEXT := NULL;
  incompatible_pk TEXT := NULL;

  estimated_ms BIGINT := 0;
  estimated_cs BIGINT := 0;
  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'MEDIUM';

  actual_udt TEXT;
  is_nullble TEXT;
  col_default TEXT;
BEGIN
  /* ── Inspect moyasar_settings ── */
  IF ms_present THEN
    SELECT COUNT(*) INTO estimated_ms FROM moyasar_settings;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='id') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.id');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='id' AND udt_name IS DISTINCT FROM 'uuid') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.id');
    END IF;

    actual_udt := NULL; is_nullble := NULL; col_default := NULL;
    SELECT c.udt_name, c.is_nullable, c.column_default
    INTO actual_udt, is_nullble, col_default
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='moyasar_settings' AND c.column_name='office_id';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.office_id');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.office_id');
    ELSE
      IF is_nullble = 'YES' THEN office_nullable := true; END IF;
      IF col_default IS NOT NULL THEN office_has_default := true; END IF;
    END IF;

    -- remaining moyasar columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='publishable_key') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.publishable_key');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='publishable_key' AND udt_name IS DISTINCT FROM 'text') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.publishable_key');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='secret_key') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.secret_key');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='secret_key' AND udt_name IS DISTINCT FROM 'text') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.secret_key');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='webhook_secret') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.webhook_secret');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='webhook_secret' AND udt_name IS DISTINCT FROM 'text') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.webhook_secret');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='callback_url') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.callback_url');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='callback_url' AND udt_name IS DISTINCT FROM 'text') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.callback_url');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='test_mode') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.test_mode');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='test_mode' AND udt_name IS DISTINCT FROM 'bool') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.test_mode');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='enabled') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.enabled');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='enabled' AND udt_name IS DISTINCT FROM 'bool') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.enabled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='created_at') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.created_at');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='created_at' AND udt_name IS DISTINCT FROM 'timestamp') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.created_at');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='updated_at') THEN
      missing_col := COALESCE(missing_col, 'moyasar_settings.updated_at');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='moyasar_settings' AND column_name='updated_at' AND udt_name IS DISTINCT FROM 'timestamp') THEN
      incompatible_type := COALESCE(incompatible_type, 'moyasar_settings.updated_at');
    END IF;

    SELECT COUNT(*) INTO null_office FROM moyasar_settings WHERE office_id IS NULL;
    SELECT COUNT(*) INTO dup_office FROM (
      SELECT office_id FROM moyasar_settings GROUP BY office_id HAVING COUNT(*) > 1
    ) d;
    /* Cast to text so incompatible office_id types (e.g. int4) do not abort preflight. */
    SELECT COUNT(*) INTO legacy_default FROM moyasar_settings WHERE office_id::text = 'default';

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.moyasar_settings'::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
        AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
    ) INTO has_pk_ms;
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.moyasar_settings'::regclass AND c.contype = 'p'
    ) AND NOT has_pk_ms THEN
      incompatible_pk := COALESCE(incompatible_pk, 'moyasar_settings');
    END IF;

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
    ) INTO has_unique_ms;

    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.moyasar_settings'::regclass
        AND c.contype = 'u'
        AND c.conname = 'moyasar_settings_office_id_key'
        AND (pg_get_constraintdef(c.oid) !~* '\(office_id\)' OR pg_get_constraintdef(c.oid) ~* ',')
    ) THEN
      incompatible_unique := COALESCE(incompatible_unique, 'moyasar_settings_office_id_key');
    END IF;
  END IF;

  /* ── Inspect checkout_settings ── */
  IF cs_present THEN
    SELECT COUNT(*) INTO estimated_cs FROM checkout_settings;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='id') THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.id');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='id' AND udt_name IS DISTINCT FROM 'uuid') THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.id');
    END IF;

    actual_udt := NULL; is_nullble := NULL; col_default := NULL;
    SELECT c.udt_name, c.is_nullable, c.column_default
    INTO actual_udt, is_nullble, col_default
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='checkout_settings' AND c.column_name='office_id';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.office_id');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.office_id');
    ELSE
      IF is_nullble = 'YES' THEN office_nullable := true; END IF;
      IF col_default IS NOT NULL THEN office_has_default := true; END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='secret_key') THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.secret_key');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='secret_key' AND udt_name IS DISTINCT FROM 'text') THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.secret_key');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='public_key') THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.public_key');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='public_key' AND udt_name IS DISTINCT FROM 'text') THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.public_key');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='webhook_secret') THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.webhook_secret');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='webhook_secret' AND udt_name IS DISTINCT FROM 'text') THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.webhook_secret');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='test_mode') THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.test_mode');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='test_mode' AND udt_name IS DISTINCT FROM 'bool') THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.test_mode');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='enabled') THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.enabled');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='enabled' AND udt_name IS DISTINCT FROM 'bool') THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.enabled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='created_at') THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.created_at');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='created_at' AND udt_name IS DISTINCT FROM 'timestamp') THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.created_at');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='updated_at') THEN
      missing_col := COALESCE(missing_col, 'checkout_settings.updated_at');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='checkout_settings' AND column_name='updated_at' AND udt_name IS DISTINCT FROM 'timestamp') THEN
      incompatible_type := COALESCE(incompatible_type, 'checkout_settings.updated_at');
    END IF;

    null_office := null_office + (SELECT COUNT(*) FROM checkout_settings WHERE office_id IS NULL);
    dup_office := dup_office + (
      SELECT COUNT(*) FROM (
        SELECT office_id FROM checkout_settings GROUP BY office_id HAVING COUNT(*) > 1
      ) d
    );
    legacy_default := legacy_default + (
      SELECT COUNT(*) FROM checkout_settings WHERE office_id::text = 'default'
    );

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.checkout_settings'::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
        AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
    ) INTO has_pk_cs;
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.checkout_settings'::regclass AND c.contype = 'p'
    ) AND NOT has_pk_cs THEN
      incompatible_pk := COALESCE(incompatible_pk, 'checkout_settings');
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
    ) INTO has_unique_cs;

    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.checkout_settings'::regclass
        AND c.contype = 'u'
        AND c.conname = 'checkout_settings_office_id_key'
        AND (pg_get_constraintdef(c.oid) !~* '\(office_id\)' OR pg_get_constraintdef(c.oid) ~* ',')
    ) THEN
      incompatible_unique := COALESCE(incompatible_unique, 'checkout_settings_office_id_key');
    END IF;
  END IF;

  /* ── Blockers first (never short-circuit past them) ── */
  IF incompatible_type IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
  ELSIF null_office > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'NULL_OFFICE_ID';
  ELSIF dup_office > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_OFFICE_ID';
  ELSIF incompatible_pk IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_PK';
  ELSIF incompatible_unique IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_UNIQUE';

  /* ── SAFE repairs ── */
  ELSIF NOT ms_present OR NOT cs_present THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'TABLE_MISSING';
    lock_risk := 'MEDIUM';
  ELSIF missing_col IS NOT NULL THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'LOW';
  ELSIF office_has_default THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'DROP_OFFICE_ID_DEFAULT';
    lock_risk := 'LOW';
  ELSIF office_nullable THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'SET_NOT_NULL_PENDING';
    lock_risk := 'LOW';
  ELSIF NOT has_pk_ms OR NOT has_pk_cs OR NOT has_unique_ms OR NOT has_unique_cs THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'MEDIUM';

  /* ── Fully correct ── */
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'GATEWAY_SETTINGS_SCHEMA_READY';
    lock_risk := 'LOW';
  END IF;

  RAISE NOTICE '032_preflight: moyasar_settings_present=% checkout_settings_present=%', ms_present, cs_present;
  RAISE NOTICE '032_preflight: missing_col=% incompatible_type=% incompatible_pk=% incompatible_unique=%',
    missing_col, incompatible_type, incompatible_pk, incompatible_unique;
  RAISE NOTICE '032_preflight: pk_ms=% pk_cs=% unique_ms=% unique_cs=%',
    has_pk_ms, has_pk_cs, has_unique_ms, has_unique_cs;
  RAISE NOTICE '032_preflight: null_office_id=% duplicate_office_id_groups=% legacy_office_id_default_rows=%',
    null_office, dup_office, legacy_default;
  RAISE NOTICE '032_preflight: office_id_has_default=% office_id_nullable=%',
    office_has_default, office_nullable;
  RAISE NOTICE '032_preflight: estimated_rows moyasar_settings=% checkout_settings=%',
    estimated_ms, estimated_cs;
  RAISE NOTICE '032_preflight: lock_risk=% (CREATE TABLE / ADD COLUMN / SET NOT NULL / DROP DEFAULT / UNIQUE)',
    lock_risk;
  RAISE NOTICE '032_preflight: chosen_action=% reason_code=%', action, reason_code;
  RAISE NOTICE '032_preflight: legacy_default_note=office_id=''default'' rows are preserved and do not alone block migration';

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '032_preflight: BLOCK — do NOT apply 032 until resolved (no DROP / invent ownership / auto-merge)';
  ELSIF action = 'ALREADY_CORRECT' THEN
    RAISE NOTICE '032_preflight: ALREADY_CORRECT — apply 032 is idempotent no-op expected';
  ELSE
    RAISE NOTICE '032_preflight: SAFE_AUTO_REPAIR — 032 can create/repair tables/columns/NOT NULL/DROP DEFAULT/UNIQUE';
  END IF;
END $$;
