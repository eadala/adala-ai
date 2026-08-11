-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 033 — READ-ONLY checks for Document V2 schema
--
-- Does not CREATE / ALTER / DROP durable objects.
-- Run before applying 033_document_v2_schema_authority.sql.
--
-- Decision ladder:
--   1. Inspect existing objects/columns/defaults/constraints/data
--   2. BLOCK_AND_MANUAL_REVIEW for blockers
--   3. SAFE_AUTO_REPAIR for missing/safe gaps
--   4. ALREADY_CORRECT only when full contract matches
--
-- document_retention_policies is separate from compliance retention_policies.
-- Never probe a missing column in a way that crashes preflight.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 033 preflight: table presence'
SELECT
  to_regclass('public.documents') IS NOT NULL AS documents_present,
  to_regclass('public.document_versions') IS NOT NULL AS document_versions_present,
  to_regclass('public.document_permissions') IS NOT NULL AS document_permissions_present,
  to_regclass('public.storage_migration_log') IS NOT NULL AS storage_migration_log_present,
  to_regclass('public.document_retention_policies') IS NOT NULL AS document_retention_policies_present,
  to_regclass('public.retention_policies') IS NOT NULL AS compliance_retention_policies_present;

\echo '▶ 033 preflight: documents extension columns'
SELECT column_name, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='documents'
  AND column_name IN (
    'storage_key','storage_provider','checksum','version','is_archived',
    'legal_category','tags','migrated_at','file_size'
  )
ORDER BY column_name;

\echo '▶ 033 preflight: chosen_action'
DO $$
DECLARE
  docs_present BOOLEAN := to_regclass('public.documents') IS NOT NULL;
  dv_present BOOLEAN := to_regclass('public.document_versions') IS NOT NULL;
  dp_present BOOLEAN := to_regclass('public.document_permissions') IS NOT NULL;
  sml_present BOOLEAN := to_regclass('public.storage_migration_log') IS NOT NULL;
  drp_present BOOLEAN := to_regclass('public.document_retention_policies') IS NOT NULL;

  incompatible_type TEXT := NULL;
  missing_col TEXT := NULL;
  missing_default TEXT := NULL;
  missing_index TEXT := NULL;
  null_required BIGINT := 0;
  dup_retention BIGINT := 0;
  incompatible_pk TEXT := NULL;
  incompatible_unique TEXT := NULL;
  incompatible_index TEXT := NULL;
  default_seed_rows BIGINT := 0;
  estimated_dv BIGINT := 0;
  estimated_dp BIGINT := 0;
  estimated_sml BIGINT := 0;
  estimated_drp BIGINT := 0;

  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'MEDIUM';

  udt TEXT;
  col_default TEXT;
  has_col BOOLEAN;
BEGIN
  IF NOT docs_present THEN
    RAISE NOTICE '033_preflight: chosen_action=BLOCK_AND_MANUAL_REVIEW reason_code=BASELINE_MISSING';
    RAISE NOTICE '033_preflight: documents baseline missing — apply Migration 003 before 033';
    RETURN;
  END IF;

  /* ── documents extension columns ── */
  FOREACH udt IN ARRAY ARRAY[
    'storage_key:text',
    'storage_provider:text',
    'checksum:text',
    'version:int4',
    'is_archived:bool',
    'legal_category:text',
    'tags:_text',
    'migrated_at:timestamptz',
    'file_size:int8'
  ] LOOP
    has_col := EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name='documents'
        AND c.column_name = split_part(udt, ':', 1)
    );
    IF NOT has_col THEN
      missing_col := COALESCE(missing_col, 'documents.' || split_part(udt, ':', 1));
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name='documents'
        AND c.column_name = split_part(udt, ':', 1)
        AND c.udt_name IS DISTINCT FROM split_part(udt, ':', 2)
    ) THEN
      incompatible_type := COALESCE(incompatible_type, 'documents.' || split_part(udt, ':', 1));
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='storage_provider'
      AND (c.column_default IS NULL OR c.column_default NOT ILIKE '%db_base64%')
  ) THEN
    missing_default := COALESCE(missing_default, 'documents.storage_provider');
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='version'
      AND (c.column_default IS NULL OR c.column_default NOT ILIKE '%1%')
  ) THEN
    missing_default := COALESCE(missing_default, 'documents.version');
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='is_archived'
      AND (c.column_default IS NULL OR c.column_default NOT ILIKE '%false%')
  ) THEN
    missing_default := COALESCE(missing_default, 'documents.is_archived');
  END IF;

  /* ── document_versions ── */
  IF NOT dv_present THEN
    NULL; -- TABLE_MISSING later
  ELSE
    SELECT COUNT(*) INTO estimated_dv FROM document_versions;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_versions' AND column_name='document_id') THEN
      missing_col := COALESCE(missing_col, 'document_versions.document_id');
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_versions' AND column_name='document_id' AND udt_name IS DISTINCT FROM 'text') THEN
      incompatible_type := COALESCE(incompatible_type, 'document_versions.document_id');
    ELSE
      null_required := null_required + (SELECT COUNT(*) FROM document_versions WHERE document_id IS NULL);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_versions' AND column_name='office_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_versions' AND column_name='office_id' AND udt_name IS DISTINCT FROM 'text') THEN
        incompatible_type := COALESCE(incompatible_type, 'document_versions.office_id');
      ELSE
        null_required := null_required + (SELECT COUNT(*) FROM document_versions WHERE office_id IS NULL);
      END IF;
    ELSE
      missing_col := COALESCE(missing_col, 'document_versions.office_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_versions' AND indexname='idx_dv_doc_id') THEN
      missing_index := COALESCE(missing_index, 'idx_dv_doc_id');
    ELSIF EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index x ON x.indrelid = t.oid
      JOIN pg_class i ON i.oid = x.indexrelid
      WHERE n.nspname='public' AND t.relname='document_versions' AND i.relname='idx_dv_doc_id'
        AND (x.indpred IS NOT NULL OR x.indisvalid IS NOT TRUE
             OR (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
                 FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
                 JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
                ) IS DISTINCT FROM ARRAY['document_id']::text[])
    ) THEN
      incompatible_index := COALESCE(incompatible_index, 'idx_dv_doc_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_versions' AND indexname='idx_dv_doc_ver') THEN
      missing_index := COALESCE(missing_index, 'idx_dv_doc_ver');
    ELSIF EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index x ON x.indrelid = t.oid
      JOIN pg_class i ON i.oid = x.indexrelid
      WHERE n.nspname='public' AND t.relname='document_versions' AND i.relname='idx_dv_doc_ver'
        AND (x.indpred IS NOT NULL OR x.indisvalid IS NOT TRUE
             OR (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
                 FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
                 JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
                ) IS DISTINCT FROM ARRAY['document_id','version_number']::text[])
    ) THEN
      incompatible_index := COALESCE(incompatible_index, 'idx_dv_doc_ver');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_versions' AND indexname='idx_dv_office') THEN
      missing_index := COALESCE(missing_index, 'idx_dv_office');
    ELSIF EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index x ON x.indrelid = t.oid
      JOIN pg_class i ON i.oid = x.indexrelid
      WHERE n.nspname='public' AND t.relname='document_versions' AND i.relname='idx_dv_office'
        AND (x.indpred IS NOT NULL OR x.indisvalid IS NOT TRUE
             OR (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
                 FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
                 JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
                ) IS DISTINCT FROM ARRAY['office_id']::text[])
    ) THEN
      incompatible_index := COALESCE(incompatible_index, 'idx_dv_office');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.document_versions'::regclass AND c.contype='p')
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.document_versions'::regclass AND c.contype='p'
           AND pg_get_constraintdef(c.oid) ILIKE '%(id)%' AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
       ) THEN
      incompatible_pk := COALESCE(incompatible_pk, 'document_versions');
    END IF;
  END IF;

  /* ── document_permissions ── */
  IF dp_present THEN
    SELECT COUNT(*) INTO estimated_dp FROM document_permissions;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_permissions' AND column_name='document_id') THEN
      null_required := null_required + (SELECT COUNT(*) FROM document_permissions WHERE document_id IS NULL);
    ELSE
      missing_col := COALESCE(missing_col, 'document_permissions.document_id');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_permissions' AND column_name='office_id') THEN
      null_required := null_required + (SELECT COUNT(*) FROM document_permissions WHERE office_id IS NULL);
    ELSE
      missing_col := COALESCE(missing_col, 'document_permissions.office_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_permissions' AND indexname='idx_dp_doc_id') THEN
      missing_index := COALESCE(missing_index, 'idx_dp_doc_id');
    ELSIF EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index x ON x.indrelid = t.oid
      JOIN pg_class i ON i.oid = x.indexrelid
      WHERE n.nspname='public' AND t.relname='document_permissions' AND i.relname='idx_dp_doc_id'
        AND (x.indpred IS NOT NULL OR x.indisvalid IS NOT TRUE
             OR (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
                 FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
                 JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
                ) IS DISTINCT FROM ARRAY['document_id']::text[])
    ) THEN
      incompatible_index := COALESCE(incompatible_index, 'idx_dp_doc_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_permissions' AND indexname='idx_dp_office') THEN
      missing_index := COALESCE(missing_index, 'idx_dp_office');
    ELSIF EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index x ON x.indrelid = t.oid
      JOIN pg_class i ON i.oid = x.indexrelid
      WHERE n.nspname='public' AND t.relname='document_permissions' AND i.relname='idx_dp_office'
        AND (x.indpred IS NOT NULL OR x.indisvalid IS NOT TRUE
             OR (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
                 FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
                 JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
                ) IS DISTINCT FROM ARRAY['office_id']::text[])
    ) THEN
      incompatible_index := COALESCE(incompatible_index, 'idx_dp_office');
    END IF;
  END IF;

  /* ── storage_migration_log ── */
  IF sml_present THEN
    SELECT COUNT(*) INTO estimated_sml FROM storage_migration_log;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='storage_migration_log' AND column_name='office_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='storage_migration_log' AND column_name='office_id' AND udt_name IS DISTINCT FROM 'text') THEN
        incompatible_type := COALESCE(incompatible_type, 'storage_migration_log.office_id');
      ELSE
        null_required := null_required + (SELECT COUNT(*) FROM storage_migration_log WHERE office_id IS NULL);
      END IF;
    ELSE
      missing_col := COALESCE(missing_col, 'storage_migration_log.office_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='storage_migration_log' AND indexname='idx_sml_office_status') THEN
      missing_index := COALESCE(missing_index, 'idx_sml_office_status');
    ELSIF EXISTS (
      SELECT 1 FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index x ON x.indrelid = t.oid
      JOIN pg_class i ON i.oid = x.indexrelid
      WHERE n.nspname='public' AND t.relname='storage_migration_log' AND i.relname='idx_sml_office_status'
        AND (x.indpred IS NOT NULL OR x.indisvalid IS NOT TRUE
             OR (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
                 FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
                 JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
                ) IS DISTINCT FROM ARRAY['office_id','status']::text[])
    ) THEN
      incompatible_index := COALESCE(incompatible_index, 'idx_sml_office_status');
    END IF;
  END IF;

  /* ── document_retention_policies ── */
  IF drp_present THEN
    SELECT COUNT(*) INTO estimated_drp FROM document_retention_policies;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_retention_policies' AND column_name='office_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_retention_policies' AND column_name='category') THEN
      null_required := null_required + (SELECT COUNT(*) FROM document_retention_policies WHERE office_id IS NULL OR category IS NULL);
      SELECT COUNT(*) INTO dup_retention FROM (
        SELECT office_id, category FROM document_retention_policies
        GROUP BY office_id, category HAVING COUNT(*) > 1
      ) d;
      default_seed_rows := (SELECT COUNT(*) FROM document_retention_policies WHERE office_id = '__default__');
    ELSE
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_retention_policies' AND column_name='office_id') THEN
        missing_col := COALESCE(missing_col, 'document_retention_policies.office_id');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_retention_policies' AND column_name='category') THEN
        missing_col := COALESCE(missing_col, 'document_retention_policies.category');
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.document_retention_policies'::regclass
        AND c.contype = 'u'
        AND c.conname = 'document_retention_policies_office_id_category_key'
        AND pg_get_constraintdef(c.oid) !~* '\(office_id,\s*category\)'
    ) THEN
      incompatible_unique := COALESCE(incompatible_unique, 'document_retention_policies_office_id_category_key');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.document_retention_policies'::regclass
        AND c.contype IN ('u','p')
        AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*category\)'
    ) THEN
      missing_index := COALESCE(missing_index, 'UNIQUE(office_id,category)');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_retention_policies' AND indexname='idx_drp_office') THEN
      missing_index := COALESCE(missing_index, 'idx_drp_office');
    END IF;
  END IF;

  /* ── Decision ladder: blockers first ── */
  IF incompatible_type IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
  ELSIF null_required > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'NULL_REQUIRED';
  ELSIF dup_retention > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_RETENTION_KEY';
  ELSIF incompatible_pk IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_PK';
  ELSIF incompatible_unique IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_UNIQUE';
  ELSIF incompatible_index IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_INDEX';

  ELSIF NOT dv_present OR NOT dp_present OR NOT sml_present OR NOT drp_present THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'TABLE_MISSING';
    lock_risk := 'MEDIUM';
  ELSIF missing_col IS NOT NULL THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'LOW';
  ELSIF missing_default IS NOT NULL THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'MISSING_COLUMN_DEFAULTS';
    lock_risk := 'LOW';
  ELSIF missing_index IS NOT NULL THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'MEDIUM';
  ELSIF drp_present AND default_seed_rows < 13 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'DEFAULT_SEED_PENDING';
    lock_risk := 'LOW';
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'DOCUMENT_V2_SCHEMA_READY';
    lock_risk := 'LOW';
  END IF;

  RAISE NOTICE '033_preflight: docs=% dv=% dp=% sml=% drp=%', docs_present, dv_present, dp_present, sml_present, drp_present;
  RAISE NOTICE '033_preflight: missing_col=% missing_default=% missing_index=%', missing_col, missing_default, missing_index;
  RAISE NOTICE '033_preflight: incompatible_type=% incompatible_pk=% incompatible_unique=% incompatible_index=%',
    incompatible_type, incompatible_pk, incompatible_unique, incompatible_index;
  RAISE NOTICE '033_preflight: null_required=% duplicate_retention_groups=% default_seed_rows=%', null_required, dup_retention, default_seed_rows;
  RAISE NOTICE '033_preflight: estimated_rows document_versions=% document_permissions=% storage_migration_log=% document_retention_policies=%',
    estimated_dv, estimated_dp, estimated_sml, estimated_drp;
  RAISE NOTICE '033_preflight: lock_risk=% (ADD COLUMN / CREATE TABLE / SET NOT NULL / UNIQUE / INDEX / seed)', lock_risk;
  RAISE NOTICE '033_preflight: chosen_action=% reason_code=%', action, reason_code;
  RAISE NOTICE '033_preflight: compliance_retention_note=retention_policies (compliance) is out of scope and must remain untouched';
  RAISE NOTICE '033_preflight: default_seed_note=__default__ document_retention_policies rows are seeded idempotently and do not alone block';

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '033_preflight: BLOCK — do NOT apply 033 until resolved';
  ELSIF action = 'ALREADY_CORRECT' THEN
    RAISE NOTICE '033_preflight: ALREADY_CORRECT — apply 033 is idempotent no-op expected';
  ELSE
    RAISE NOTICE '033_preflight: SAFE_AUTO_REPAIR — 033 can create/repair Document V2 schema';
  END IF;
END $$;
