-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 033: Document V2 schema authority (Stage 23.5B)
--
-- Owns:
--   documents extension columns (the documents baseline remains Migration 003)
--   document_versions
--   document_permissions
--   storage_migration_log
--   document_retention_policies
--
-- Does not own or touch:
--   retention_policies (compliance)
--   document_center_files / document_ai_metadata / rag_chunks (Migration 021)
--
-- Idempotent and fail-closed: rows are preserved, types are never coerced,
-- and incompatible constraints or indexes require manual review.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── A) documents extensions ────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION
      '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=BASELINE_MISSING) — public.documents is missing; apply the baseline migration first';
  END IF;
END $$;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_provider TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS legal_category TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;

DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
BEGIN
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('storage_key',      'text'),
      ('storage_provider', 'text'),
      ('checksum',         'text'),
      ('version',          'int4'),
      ('is_archived',      'bool'),
      ('legal_category',   'text'),
      ('tags',             '_text'),
      ('migrated_at',      'timestamptz'),
      ('file_size',        'int8')
    ) AS expected(column_name, udt_name)
  LOOP
    SELECT c.udt_name
      INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'documents'
      AND c.column_name = spec.column_name;

    IF actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.% has udt %, expected %',
        spec.column_name, actual_udt, spec.udt_name;
    END IF;
  END LOOP;
END $$;

ALTER TABLE documents ALTER COLUMN storage_provider SET DEFAULT 'db_base64';
ALTER TABLE documents ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE documents ALTER COLUMN is_archived SET DEFAULT false;
ALTER TABLE documents ALTER COLUMN file_size DROP NOT NULL;

-- ── B) document_versions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id      TEXT NOT NULL,
  office_id        TEXT NOT NULL,
  version_number   INT NOT NULL DEFAULT 1,
  storage_key      TEXT,
  storage_provider TEXT DEFAULT 'cloudflare_r2',
  checksum         TEXT,
  file_size        BIGINT DEFAULT 0,
  mime_type        TEXT,
  uploaded_by      TEXT,
  uploaded_by_name TEXT,
  change_summary   TEXT,
  is_current       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS version_number INT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS storage_provider TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS is_current BOOLEAN;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── C) document_permissions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_permissions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id     TEXT NOT NULL,
  office_id       TEXT NOT NULL,
  permission_type TEXT NOT NULL DEFAULT 'TEAM',
  role_id         TEXT,
  user_id         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS permission_type TEXT;
ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS role_id TEXT;
ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── D) storage_migration_log ──────────────────────────────────────────────
-- No UNIQUE constraint is part of this table's contract.
CREATE TABLE IF NOT EXISTS storage_migration_log (
  id           SERIAL PRIMARY KEY,
  office_id    TEXT NOT NULL,
  table_name   TEXT NOT NULL,
  record_id    TEXT NOT NULL,
  old_provider TEXT DEFAULT 'db_base64',
  new_key      TEXT,
  file_size    BIGINT,
  checksum     TEXT,
  status       TEXT DEFAULT 'pending',
  error_msg    TEXT,
  migrated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS old_provider TEXT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS new_key TEXT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS error_msg TEXT;
ALTER TABLE storage_migration_log ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;

-- ── E) document_retention_policies ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_retention_policies (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id          TEXT NOT NULL,
  category           TEXT NOT NULL,
  retention_years    INT NOT NULL DEFAULT 7,
  archive_after_days INT DEFAULT 365,
  auto_delete        BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT document_retention_policies_office_id_category_key
    UNIQUE (office_id, category)
);

ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS retention_years INT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS archive_after_days INT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS auto_delete BOOLEAN;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Validate every existing or newly-added V2 column before applying defaults
-- or constraints. This is intentionally type-only: no coercion is attempted.
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
BEGIN
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('document_versions', 'id',               'text'),
      ('document_versions', 'document_id',      'text'),
      ('document_versions', 'office_id',        'text'),
      ('document_versions', 'version_number',   'int4'),
      ('document_versions', 'storage_key',      'text'),
      ('document_versions', 'storage_provider', 'text'),
      ('document_versions', 'checksum',         'text'),
      ('document_versions', 'file_size',        'int8'),
      ('document_versions', 'mime_type',        'text'),
      ('document_versions', 'uploaded_by',      'text'),
      ('document_versions', 'uploaded_by_name', 'text'),
      ('document_versions', 'change_summary',   'text'),
      ('document_versions', 'is_current',       'bool'),
      ('document_versions', 'created_at',       'timestamptz'),

      ('document_permissions', 'id',              'text'),
      ('document_permissions', 'document_id',     'text'),
      ('document_permissions', 'office_id',       'text'),
      ('document_permissions', 'permission_type', 'text'),
      ('document_permissions', 'role_id',         'text'),
      ('document_permissions', 'user_id',         'text'),
      ('document_permissions', 'created_at',      'timestamptz'),

      ('storage_migration_log', 'id',           'int4'),
      ('storage_migration_log', 'office_id',    'text'),
      ('storage_migration_log', 'table_name',   'text'),
      ('storage_migration_log', 'record_id',    'text'),
      ('storage_migration_log', 'old_provider', 'text'),
      ('storage_migration_log', 'new_key',      'text'),
      ('storage_migration_log', 'file_size',    'int8'),
      ('storage_migration_log', 'checksum',     'text'),
      ('storage_migration_log', 'status',       'text'),
      ('storage_migration_log', 'error_msg',    'text'),
      ('storage_migration_log', 'migrated_at',  'timestamptz'),

      ('document_retention_policies', 'id',                 'text'),
      ('document_retention_policies', 'office_id',          'text'),
      ('document_retention_policies', 'category',           'text'),
      ('document_retention_policies', 'retention_years',    'int4'),
      ('document_retention_policies', 'archive_after_days', 'int4'),
      ('document_retention_policies', 'auto_delete',        'bool'),
      ('document_retention_policies', 'created_at',         'timestamptz'),
      ('document_retention_policies', 'updated_at',         'timestamptz')
    ) AS expected(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name
      INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;

    IF actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, actual_udt, spec.udt_name;
    END IF;
  END LOOP;
END $$;

-- Canonical defaults. Existing row values are not rewritten.
ALTER TABLE document_versions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE document_versions ALTER COLUMN version_number SET DEFAULT 1;
ALTER TABLE document_versions ALTER COLUMN storage_provider SET DEFAULT 'cloudflare_r2';
ALTER TABLE document_versions ALTER COLUMN file_size SET DEFAULT 0;
ALTER TABLE document_versions ALTER COLUMN is_current SET DEFAULT false;
ALTER TABLE document_versions ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE document_permissions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE document_permissions ALTER COLUMN permission_type SET DEFAULT 'TEAM';
ALTER TABLE document_permissions ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE storage_migration_log ALTER COLUMN old_provider SET DEFAULT 'db_base64';
ALTER TABLE storage_migration_log ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE storage_migration_log ALTER COLUMN migrated_at SET DEFAULT NOW();

ALTER TABLE document_retention_policies ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE document_retention_policies ALTER COLUMN retention_years SET DEFAULT 7;
ALTER TABLE document_retention_policies ALTER COLUMN archive_after_days SET DEFAULT 365;
ALTER TABLE document_retention_policies ALTER COLUMN auto_delete SET DEFAULT false;
ALTER TABLE document_retention_policies ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE document_retention_policies ALTER COLUMN updated_at SET DEFAULT NOW();

-- Required-column guards run before SET NOT NULL.
DO $$
DECLARE
  spec RECORD;
  null_count BIGINT;
BEGIN
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('document_versions',
       'id IS NULL OR document_id IS NULL OR office_id IS NULL OR version_number IS NULL'),
      ('document_permissions',
       'id IS NULL OR document_id IS NULL OR office_id IS NULL OR permission_type IS NULL'),
      ('storage_migration_log',
       'id IS NULL OR office_id IS NULL OR table_name IS NULL OR record_id IS NULL'),
      ('document_retention_policies',
       'id IS NULL OR office_id IS NULL OR category IS NULL OR retention_years IS NULL')
    ) AS required(table_name, null_predicate)
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM public.%I WHERE %s',
      spec.table_name,
      spec.null_predicate
    ) INTO null_count;

    IF null_count > 0 THEN
      RAISE EXCEPTION
        '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % has % row(s) with NULL required values',
        spec.table_name, null_count;
    END IF;
  END LOOP;
END $$;

ALTER TABLE document_versions ALTER COLUMN id SET NOT NULL;
ALTER TABLE document_versions ALTER COLUMN document_id SET NOT NULL;
ALTER TABLE document_versions ALTER COLUMN office_id SET NOT NULL;
ALTER TABLE document_versions ALTER COLUMN version_number SET NOT NULL;

ALTER TABLE document_permissions ALTER COLUMN id SET NOT NULL;
ALTER TABLE document_permissions ALTER COLUMN document_id SET NOT NULL;
ALTER TABLE document_permissions ALTER COLUMN office_id SET NOT NULL;
ALTER TABLE document_permissions ALTER COLUMN permission_type SET NOT NULL;

ALTER TABLE storage_migration_log ALTER COLUMN id SET NOT NULL;
ALTER TABLE storage_migration_log ALTER COLUMN office_id SET NOT NULL;
ALTER TABLE storage_migration_log ALTER COLUMN table_name SET NOT NULL;
ALTER TABLE storage_migration_log ALTER COLUMN record_id SET NOT NULL;

ALTER TABLE document_retention_policies ALTER COLUMN id SET NOT NULL;
ALTER TABLE document_retention_policies ALTER COLUMN office_id SET NOT NULL;
ALTER TABLE document_retention_policies ALTER COLUMN category SET NOT NULL;
ALTER TABLE document_retention_policies ALTER COLUMN retention_years SET NOT NULL;

-- Every V2 table has a primary key solely on id. Missing safe PKs are added;
-- wrong existing PK shapes are never replaced.
DO $$
DECLARE
  spec RECORD;
  table_oid OID;
  id_attnum SMALLINT;
  duplicate_count BIGINT;
BEGIN
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('document_versions',          'document_versions_pkey'),
      ('document_permissions',       'document_permissions_pkey'),
      ('storage_migration_log',      'storage_migration_log_pkey'),
      ('document_retention_policies','document_retention_policies_pkey')
    ) AS expected(table_name, constraint_name)
  LOOP
    table_oid := to_regclass(format('public.%I', spec.table_name));

    SELECT a.attnum::smallint
      INTO id_attnum
    FROM pg_attribute a
    WHERE a.attrelid = table_oid
      AND a.attname = 'id'
      AND NOT a.attisdropped;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = table_oid
        AND c.contype = 'p'
        AND c.conkey IS DISTINCT FROM ARRAY[id_attnum]::smallint[]
    ) THEN
      RAISE EXCEPTION
        '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % primary key is not solely (id)',
        spec.table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = table_oid
        AND c.contype = 'p'
        AND c.conkey = ARRAY[id_attnum]::smallint[]
    ) THEN
      EXECUTE format(
        'SELECT COUNT(*) FROM (SELECT id FROM public.%I GROUP BY id HAVING COUNT(*) > 1) duplicate_ids',
        spec.table_name
      ) INTO duplicate_count;

      IF duplicate_count > 0 THEN
        RAISE EXCEPTION
          '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % has % duplicate id group(s)',
          spec.table_name, duplicate_count;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = table_oid
          AND c.conname = spec.constraint_name
      ) THEN
        RAISE EXCEPTION
          '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % already has a non-PK constraint named %',
          spec.table_name, spec.constraint_name;
      END IF;

      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)',
        spec.table_name,
        spec.constraint_name
      );
    END IF;
  END LOOP;
END $$;

-- SERIAL generation repair. Identity and any nextval(...) default are valid.
-- A missing generator on an int4 id with PK(id) is repaired without rewriting
-- existing ids.
DO $$
DECLARE
  id_default TEXT;
  identity_flag TEXT;
  table_oid OID := 'public.storage_migration_log'::regclass;
  id_attnum SMALLINT;
  sequence_oid OID;
  sequence_kind "char";
  next_id BIGINT;
BEGIN
  SELECT c.column_default, c.is_identity
    INTO id_default, identity_flag
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'storage_migration_log'
    AND c.column_name = 'id';

  SELECT a.attnum::smallint
    INTO id_attnum
  FROM pg_attribute a
  WHERE a.attrelid = table_oid
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF identity_flag IS DISTINCT FROM 'YES'
     AND COALESCE(id_default, '') !~* 'nextval[[:space:]]*\(' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = table_oid
        AND c.contype = 'p'
        AND c.conkey = ARRAY[id_attnum]::smallint[]
    ) THEN
      RAISE EXCEPTION
        '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_ID_GENERATION) — storage_migration_log.id cannot be repaired without PK(id)';
    END IF;

    BEGIN
      sequence_oid := to_regclass('public.storage_migration_log_id_seq');
      IF sequence_oid IS NULL THEN
        CREATE SEQUENCE public.storage_migration_log_id_seq;
        sequence_oid := 'public.storage_migration_log_id_seq'::regclass;
      ELSE
        SELECT c.relkind
          INTO sequence_kind
        FROM pg_class c
        WHERE c.oid = sequence_oid;

        IF sequence_kind IS DISTINCT FROM 'S' THEN
          RAISE EXCEPTION 'storage_migration_log_id_seq exists but is not a sequence';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass
            AND d.objid = sequence_oid
            AND d.refclassid = 'pg_class'::regclass
            AND d.deptype IN ('a', 'i')
            AND (d.refobjid IS DISTINCT FROM table_oid OR d.refobjsubid IS DISTINCT FROM id_attnum)
        ) THEN
          RAISE EXCEPTION 'storage_migration_log_id_seq is owned by another column';
        END IF;
      END IF;

      ALTER SEQUENCE public.storage_migration_log_id_seq
        OWNED BY storage_migration_log.id;
      ALTER TABLE storage_migration_log
        ALTER COLUMN id SET DEFAULT nextval('public.storage_migration_log_id_seq'::regclass);

      SELECT COALESCE(MAX(id), 0)::bigint + 1
        INTO next_id
      FROM storage_migration_log;
      PERFORM setval('public.storage_migration_log_id_seq'::regclass, next_id, false);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION
          '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_ID_GENERATION) — storage_migration_log.id generator repair failed: %',
          SQLERRM;
    END;
  END IF;
END $$;

-- Retention duplicate and UNIQUE-constraint authority. A standalone unique
-- index is not has_unique; ON CONFLICT requires a real pg_constraint row.
DO $$
DECLARE
  table_oid OID := 'public.document_retention_policies'::regclass;
  office_attnum SMALLINT;
  category_attnum SMALLINT;
  duplicate_count BIGINT;
  has_unique BOOLEAN;
  named_index_oid OID;
  reusable_named_index BOOLEAN := false;
BEGIN
  SELECT a.attnum::smallint
    INTO office_attnum
  FROM pg_attribute a
  WHERE a.attrelid = table_oid
    AND a.attname = 'office_id'
    AND NOT a.attisdropped;

  SELECT a.attnum::smallint
    INTO category_attnum
  FROM pg_attribute a
  WHERE a.attrelid = table_oid
    AND a.attname = 'category'
    AND NOT a.attisdropped;

  SELECT COUNT(*)
    INTO duplicate_count
  FROM (
    SELECT office_id, category
    FROM document_retention_policies
    GROUP BY office_id, category
    HAVING COUNT(*) > 1
  ) duplicate_keys;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_RETENTION_KEY) — % duplicate (office_id, category) group(s); no rows were merged',
      duplicate_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    LEFT JOIN pg_index x ON x.indexrelid = c.conindid
    WHERE c.conrelid = table_oid
      AND c.conname = 'document_retention_policies_office_id_category_key'
      AND NOT (
        c.contype = 'u'
        AND c.conkey = ARRAY[office_attnum, category_attnum]::smallint[]
        AND c.convalidated IS TRUE
        AND x.indpred IS NULL
        AND x.indexprs IS NULL
        AND x.indisvalid IS TRUE
        AND x.indisready IS TRUE
        AND x.indnkeyatts = 2
        AND x.indnatts = 2
      )
  ) THEN
    RAISE EXCEPTION
      '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — named retention constraint has the wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_index x ON x.indexrelid = c.conindid
    WHERE c.conrelid = table_oid
      AND c.contype = 'u'
      AND c.conkey = ARRAY[office_attnum, category_attnum]::smallint[]
      AND c.convalidated IS TRUE
      AND x.indpred IS NULL
      AND x.indexprs IS NULL
      AND x.indisvalid IS TRUE
      AND x.indisready IS TRUE
      AND x.indnkeyatts = 2
      AND x.indnatts = 2
  ) INTO has_unique;

  IF NOT has_unique THEN
    named_index_oid := to_regclass('public.document_retention_policies_office_id_category_key');

    IF named_index_oid IS NOT NULL THEN
      SELECT
        x.indrelid = table_oid
        AND x.indisunique IS TRUE
        AND x.indisvalid IS TRUE
        AND x.indisready IS TRUE
        AND x.indpred IS NULL
        AND x.indexprs IS NULL
        AND x.indnkeyatts = 2
        AND x.indnatts = 2
        AND x.indkey[0] = office_attnum
        AND x.indkey[1] = category_attnum
        AND am.amname = 'btree'
      INTO reusable_named_index
      FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_am am ON am.oid = i.relam
      WHERE x.indexrelid = named_index_oid;

      IF reusable_named_index IS DISTINCT FROM true THEN
        RAISE EXCEPTION
          '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — relation named document_retention_policies_office_id_category_key prevents adding the required constraint';
      END IF;

      BEGIN
        ALTER TABLE document_retention_policies
          ADD CONSTRAINT document_retention_policies_office_id_category_key
          UNIQUE USING INDEX document_retention_policies_office_id_category_key;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE EXCEPTION
            '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — could not attach the existing unique index as a constraint: %',
            SQLERRM;
      END;
    ELSE
      ALTER TABLE document_retention_policies
        ADD CONSTRAINT document_retention_policies_office_id_category_key
        UNIQUE (office_id, category);
    END IF;
  END IF;
END $$;

-- Every required named index is non-unique, non-partial, non-expression,
-- valid, ready, and has exactly the declared columns in order.
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
BEGIN
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('idx_dv_doc_id',          'document_versions',          ARRAY['document_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_dv_doc_id ON document_versions (document_id)'),
      ('idx_dv_doc_ver',         'document_versions',          ARRAY['document_id','version_number']::text[],
       'CREATE INDEX IF NOT EXISTS idx_dv_doc_ver ON document_versions (document_id, version_number)'),
      ('idx_dv_office',          'document_versions',          ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_dv_office ON document_versions (office_id)'),
      ('idx_dp_doc_id',          'document_permissions',       ARRAY['document_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_dp_doc_id ON document_permissions (document_id)'),
      ('idx_dp_office',          'document_permissions',       ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_dp_office ON document_permissions (office_id)'),
      ('idx_sml_office_status',  'storage_migration_log',      ARRAY['office_id','status']::text[],
       'CREATE INDEX IF NOT EXISTS idx_sml_office_status ON storage_migration_log (office_id, status)'),
      ('idx_drp_office',         'document_retention_policies',ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_drp_office ON document_retention_policies (office_id)')
    ) AS expected(index_name, table_name, columns, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    actual_table_oid := NULL;
    index_unique := NULL;
    index_partial := NULL;
    index_expression := NULL;
    index_valid := NULL;
    index_ready := NULL;
    index_columns := NULL;

    SELECT
      x.indrelid,
      x.indisunique,
      x.indpred IS NOT NULL,
      x.indexprs IS NOT NULL,
      x.indisvalid,
      x.indisready,
      (
        SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY
          AS key_column(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid
         AND a.attnum = key_column.attnum
         AND NOT a.attisdropped
      )
    INTO
      actual_table_oid,
      index_unique,
      index_partial,
      index_expression,
      index_valid,
      index_ready,
      index_columns
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    WHERE n.nspname = 'public'
      AND i.relname = spec.index_name;

    IF NOT FOUND THEN
      EXECUTE spec.create_sql;
    ELSIF actual_table_oid IS DISTINCT FROM expected_table_oid
       OR index_unique IS TRUE
       OR index_partial IS TRUE
       OR index_expression IS TRUE
       OR index_valid IS NOT TRUE
       OR index_ready IS NOT TRUE
       OR index_columns IS DISTINCT FROM spec.columns THEN
      RAISE EXCEPTION
        '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (table=% unique=% partial=% expression=% valid=% ready=% columns=% expected=%)',
        spec.index_name, actual_table_oid::regclass, index_unique, index_partial,
        index_expression, index_valid, index_ready, index_columns, spec.columns;
    END IF;
  END LOOP;
END $$;

-- Seed only the Document Center defaults. Existing rows win by contract.
INSERT INTO document_retention_policies
  (office_id, category, retention_years, archive_after_days)
VALUES
  ('__default__', 'وكالة', 10, 3650),
  ('__default__', 'عقد', 10, 3650),
  ('__default__', 'حكم', 10, 3650),
  ('__default__', 'مذكرة', 7, 2555),
  ('__default__', 'لائحة_دعوى', 10, 3650),
  ('__default__', 'محضر_جلسة', 7, 2555),
  ('__default__', 'تقرير_خبير', 10, 3650),
  ('__default__', 'مستند_إفلاس', 10, 3650),
  ('__default__', 'فاتورة', 7, 2555),
  ('__default__', 'مستند_مالي', 7, 2555),
  ('__default__', 'هوية', 5, 1825),
  ('__default__', 'سجل_تجاري', 10, 3650),
  ('__default__', 'أخرى', 5, 1825)
ON CONFLICT (office_id, category) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness (must pass before COMMIT)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  nullable_flag TEXT;
  actual_default TEXT;
  normalized_default TEXT;
  table_oid OID;
  id_attnum SMALLINT;
  office_attnum SMALLINT;
  category_attnum SMALLINT;
  id_default TEXT;
  identity_flag TEXT;
  probe_id INTEGER;
  probe_text_id TEXT;
  probe_token TEXT;
  expected_table_oid OID;
  actual_table_oid OID;
  index_unique BOOLEAN;
  index_partial BOOLEAN;
  index_expression BOOLEAN;
  index_valid BOOLEAN;
  index_ready BOOLEAN;
  index_columns TEXT[];
BEGIN
  IF to_regclass('public.documents') IS NULL
     OR to_regclass('public.document_versions') IS NULL
     OR to_regclass('public.document_permissions') IS NULL
     OR to_regclass('public.storage_migration_log') IS NULL
     OR to_regclass('public.document_retention_policies') IS NULL THEN
    RAISE EXCEPTION
      '033_document_v2: POST_APPLY_READINESS_FAILED — one or more required tables are missing';
  END IF;

  -- All required column types, including every app-read Document V2 column.
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('documents', 'storage_key',      'text'),
      ('documents', 'storage_provider', 'text'),
      ('documents', 'checksum',         'text'),
      ('documents', 'version',          'int4'),
      ('documents', 'is_archived',      'bool'),
      ('documents', 'legal_category',   'text'),
      ('documents', 'tags',             '_text'),
      ('documents', 'migrated_at',      'timestamptz'),
      ('documents', 'file_size',        'int8'),

      ('document_versions', 'id',               'text'),
      ('document_versions', 'document_id',      'text'),
      ('document_versions', 'office_id',        'text'),
      ('document_versions', 'version_number',   'int4'),
      ('document_versions', 'storage_key',      'text'),
      ('document_versions', 'storage_provider', 'text'),
      ('document_versions', 'checksum',         'text'),
      ('document_versions', 'file_size',        'int8'),
      ('document_versions', 'mime_type',        'text'),
      ('document_versions', 'uploaded_by',      'text'),
      ('document_versions', 'uploaded_by_name', 'text'),
      ('document_versions', 'change_summary',   'text'),
      ('document_versions', 'is_current',       'bool'),
      ('document_versions', 'created_at',       'timestamptz'),

      ('document_permissions', 'id',              'text'),
      ('document_permissions', 'document_id',     'text'),
      ('document_permissions', 'office_id',       'text'),
      ('document_permissions', 'permission_type', 'text'),
      ('document_permissions', 'role_id',         'text'),
      ('document_permissions', 'user_id',         'text'),
      ('document_permissions', 'created_at',      'timestamptz'),

      ('storage_migration_log', 'id',           'int4'),
      ('storage_migration_log', 'office_id',    'text'),
      ('storage_migration_log', 'table_name',   'text'),
      ('storage_migration_log', 'record_id',    'text'),
      ('storage_migration_log', 'old_provider', 'text'),
      ('storage_migration_log', 'new_key',      'text'),
      ('storage_migration_log', 'file_size',    'int8'),
      ('storage_migration_log', 'checksum',     'text'),
      ('storage_migration_log', 'status',       'text'),
      ('storage_migration_log', 'error_msg',    'text'),
      ('storage_migration_log', 'migrated_at',  'timestamptz'),

      ('document_retention_policies', 'id',                 'text'),
      ('document_retention_policies', 'office_id',          'text'),
      ('document_retention_policies', 'category',           'text'),
      ('document_retention_policies', 'retention_years',    'int4'),
      ('document_retention_policies', 'archive_after_days', 'int4'),
      ('document_retention_policies', 'auto_delete',        'bool'),
      ('document_retention_policies', 'created_at',         'timestamptz'),
      ('document_retention_policies', 'updated_at',         'timestamptz')
    ) AS expected(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name
      INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;

    IF actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — %.% has udt %, expected %',
        spec.table_name, spec.column_name, actual_udt, spec.udt_name;
    END IF;
  END LOOP;

  -- Required NOT NULL shape.
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('document_versions', 'id'),
      ('document_versions', 'document_id'),
      ('document_versions', 'office_id'),
      ('document_versions', 'version_number'),
      ('document_permissions', 'id'),
      ('document_permissions', 'document_id'),
      ('document_permissions', 'office_id'),
      ('document_permissions', 'permission_type'),
      ('storage_migration_log', 'id'),
      ('storage_migration_log', 'office_id'),
      ('storage_migration_log', 'table_name'),
      ('storage_migration_log', 'record_id'),
      ('document_retention_policies', 'id'),
      ('document_retention_policies', 'office_id'),
      ('document_retention_policies', 'category'),
      ('document_retention_policies', 'retention_years')
    ) AS expected(table_name, column_name)
  LOOP
    SELECT c.is_nullable
      INTO nullable_flag
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;

    IF nullable_flag IS DISTINCT FROM 'NO' THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — %.% is not NOT NULL',
        spec.table_name, spec.column_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'documents'
      AND c.column_name = 'file_size'
      AND c.udt_name = 'int8'
      AND c.is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION
      '033_document_v2: POST_APPLY_READINESS_FAILED — documents.file_size must be nullable BIGINT';
  END IF;

  -- The version default check deliberately rejects 10, 11, casts of those,
  -- and any expression that merely contains the character "1".
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'version'
      AND regexp_replace(trim(both from split_part(column_default, '::', 1)), '''', '', 'g') = '1'
  ) THEN
    RAISE EXCEPTION
      '033_document_v2: POST_APPLY_READINESS_FAILED — documents.version default is not exactly 1';
  END IF;

  -- Scalar defaults normalized only for PostgreSQL's optional type cast.
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('documents', 'storage_provider', 'db_base64'),
      ('documents', 'is_archived', 'false'),
      ('document_versions', 'version_number', '1'),
      ('document_versions', 'storage_provider', 'cloudflare_r2'),
      ('document_versions', 'file_size', '0'),
      ('document_versions', 'is_current', 'false'),
      ('document_permissions', 'permission_type', 'TEAM'),
      ('storage_migration_log', 'old_provider', 'db_base64'),
      ('storage_migration_log', 'status', 'pending'),
      ('document_retention_policies', 'retention_years', '7'),
      ('document_retention_policies', 'archive_after_days', '365'),
      ('document_retention_policies', 'auto_delete', 'false')
    ) AS expected(table_name, column_name, default_value)
  LOOP
    SELECT c.column_default
      INTO actual_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;

    normalized_default :=
      regexp_replace(trim(both from split_part(actual_default, '::', 1)), '''', '', 'g');

    IF normalized_default IS DISTINCT FROM spec.default_value THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — %.% default % does not normalize to %',
        spec.table_name, spec.column_name, actual_default, spec.default_value;
    END IF;
  END LOOP;

  -- UUID text ids and timestamp defaults.
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('document_versions', 'id'),
      ('document_permissions', 'id'),
      ('document_retention_policies', 'id')
    ) AS expected(table_name, column_name)
  LOOP
    SELECT c.column_default
      INTO actual_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;

    IF regexp_replace(lower(COALESCE(actual_default, '')), '[[:space:]()]', '', 'g')
         IS DISTINCT FROM 'gen_random_uuid::text' THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — %.% UUID-text default is missing or incompatible',
        spec.table_name, spec.column_name;
    END IF;
  END LOOP;

  FOR spec IN
    SELECT *
    FROM (VALUES
      ('document_versions', 'created_at'),
      ('document_permissions', 'created_at'),
      ('storage_migration_log', 'migrated_at'),
      ('document_retention_policies', 'created_at'),
      ('document_retention_policies', 'updated_at')
    ) AS expected(table_name, column_name)
  LOOP
    SELECT c.column_default
      INTO actual_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;

    IF regexp_replace(lower(COALESCE(actual_default, '')), '[[:space:]]', '', 'g')
         IS DISTINCT FROM 'now()' THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — %.% default is not NOW()',
        spec.table_name, spec.column_name;
    END IF;
  END LOOP;

  -- PK solely (id) on every V2 table.
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('document_versions'),
      ('document_permissions'),
      ('storage_migration_log'),
      ('document_retention_policies')
    ) AS expected(table_name)
  LOOP
    table_oid := to_regclass(format('public.%I', spec.table_name));
    SELECT a.attnum::smallint
      INTO id_attnum
    FROM pg_attribute a
    WHERE a.attrelid = table_oid
      AND a.attname = 'id'
      AND NOT a.attisdropped;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = table_oid
        AND c.contype = 'p'
        AND c.conkey = ARRAY[id_attnum]::smallint[]
        AND c.convalidated IS TRUE
    ) THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — % does not have a validated PK solely on id',
        spec.table_name;
    END IF;
  END LOOP;

  -- Re-query pg_index for every required non-unique index.
  FOR spec IN
    SELECT *
    FROM (VALUES
      ('idx_dv_doc_id',         'document_versions',           ARRAY['document_id']::text[]),
      ('idx_dv_doc_ver',        'document_versions',           ARRAY['document_id','version_number']::text[]),
      ('idx_dv_office',         'document_versions',           ARRAY['office_id']::text[]),
      ('idx_dp_doc_id',         'document_permissions',        ARRAY['document_id']::text[]),
      ('idx_dp_office',         'document_permissions',        ARRAY['office_id']::text[]),
      ('idx_sml_office_status', 'storage_migration_log',       ARRAY['office_id','status']::text[]),
      ('idx_drp_office',        'document_retention_policies', ARRAY['office_id']::text[])
    ) AS expected(index_name, table_name, columns)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    actual_table_oid := NULL;
    index_unique := NULL;
    index_partial := NULL;
    index_expression := NULL;
    index_valid := NULL;
    index_ready := NULL;
    index_columns := NULL;

    SELECT
      x.indrelid,
      x.indisunique,
      x.indpred IS NOT NULL,
      x.indexprs IS NOT NULL,
      x.indisvalid,
      x.indisready,
      (
        SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY
          AS key_column(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid
         AND a.attnum = key_column.attnum
         AND NOT a.attisdropped
      )
    INTO
      actual_table_oid,
      index_unique,
      index_partial,
      index_expression,
      index_valid,
      index_ready,
      index_columns
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    WHERE n.nspname = 'public'
      AND i.relname = spec.index_name;

    IF NOT FOUND
       OR actual_table_oid IS DISTINCT FROM expected_table_oid
       OR index_unique IS TRUE
       OR index_partial IS TRUE
       OR index_expression IS TRUE
       OR index_valid IS NOT TRUE
       OR index_ready IS NOT TRUE
       OR index_columns IS DISTINCT FROM spec.columns THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — required index % is missing or incompatible',
        spec.index_name;
    END IF;
  END LOOP;

  -- A real, exact, non-partial UNIQUE constraint is the retention arbiter.
  table_oid := 'public.document_retention_policies'::regclass;
  SELECT a.attnum::smallint
    INTO office_attnum
  FROM pg_attribute a
  WHERE a.attrelid = table_oid
    AND a.attname = 'office_id'
    AND NOT a.attisdropped;
  SELECT a.attnum::smallint
    INTO category_attnum
  FROM pg_attribute a
  WHERE a.attrelid = table_oid
    AND a.attname = 'category'
    AND NOT a.attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_index x ON x.indexrelid = c.conindid
    WHERE c.conrelid = table_oid
      AND c.contype = 'u'
      AND c.conkey = ARRAY[office_attnum, category_attnum]::smallint[]
      AND c.convalidated IS TRUE
      AND x.indpred IS NULL
      AND x.indexprs IS NULL
      AND x.indisvalid IS TRUE
      AND x.indisready IS TRUE
      AND x.indnkeyatts = 2
      AND x.indnatts = 2
  ) THEN
    RAISE EXCEPTION
      '033_document_v2: POST_APPLY_READINESS_FAILED — exact UNIQUE constraint on (office_id, category) is missing';
  END IF;

  -- storage_migration_log id must generate without an explicit id.
  SELECT c.column_default, c.is_identity
    INTO id_default, identity_flag
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'storage_migration_log'
    AND c.column_name = 'id';

  IF identity_flag IS DISTINCT FROM 'YES'
     AND COALESCE(id_default, '') !~* 'nextval[[:space:]]*\(' THEN
    RAISE EXCEPTION
      '033_document_v2: POST_APPLY_READINESS_FAILED — storage_migration_log.id has neither identity nor nextval generation';
  END IF;

  probe_token := '__033_sml_probe__' || gen_random_uuid()::text;
  BEGIN
    INSERT INTO storage_migration_log (office_id, table_name, record_id)
    VALUES (probe_token, probe_token, probe_token)
    RETURNING id INTO probe_id;

    IF probe_id IS NULL THEN
      RAISE EXCEPTION 'probe insert returned a NULL id';
    END IF;

    DELETE FROM storage_migration_log
    WHERE id = probe_id
      AND office_id = probe_token;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'probe row could not be deleted';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — storage_migration_log insert-without-id probe failed: %',
        SQLERRM;
  END;

  -- Exercise the actual ON CONFLICT arbiter and remove the probe row.
  probe_token := '__033_drp_probe__' || gen_random_uuid()::text;
  BEGIN
    INSERT INTO document_retention_policies
      (office_id, category, retention_years, archive_after_days)
    VALUES (probe_token, probe_token, 7, 365)
    ON CONFLICT (office_id, category) DO NOTHING
    RETURNING id INTO probe_text_id;

    IF probe_text_id IS NULL THEN
      RAISE EXCEPTION 'first retention probe insert did not create a row';
    END IF;

    INSERT INTO document_retention_policies
      (office_id, category, retention_years, archive_after_days)
    VALUES (probe_token, probe_token, 7, 365)
    ON CONFLICT (office_id, category) DO NOTHING;

    DELETE FROM document_retention_policies
    WHERE id = probe_text_id
      AND office_id = probe_token
      AND category = probe_token;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'retention probe row could not be deleted';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION
        '033_document_v2: POST_APPLY_READINESS_FAILED — retention ON CONFLICT probe failed: %',
        SQLERRM;
  END;

  -- Check the exact expected category set by name, not merely a row count.
  IF EXISTS (
    WITH expected_categories(category) AS (
      VALUES
        ('وكالة'),
        ('عقد'),
        ('حكم'),
        ('مذكرة'),
        ('لائحة_دعوى'),
        ('محضر_جلسة'),
        ('تقرير_خبير'),
        ('مستند_إفلاس'),
        ('فاتورة'),
        ('مستند_مالي'),
        ('هوية'),
        ('سجل_تجاري'),
        ('أخرى')
    )
    SELECT category FROM expected_categories
    EXCEPT
    SELECT category
    FROM document_retention_policies
    WHERE office_id = '__default__'
  ) THEN
    RAISE EXCEPTION
      '033_document_v2: POST_APPLY_READINESS_FAILED — one or more expected __default__ retention categories are missing';
  END IF;

  RAISE NOTICE
    '033_document_v2: post-apply readiness passed';
END $$;

COMMIT;
