-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 033: Document V2 schema authority (Stage 23.5B)
--
-- Owns:
--   documents extension columns (storage_* / file_size / …) — 003 keeps baseline
--   document_versions
--   document_permissions
--   storage_migration_log
--   document_retention_policies  (NEW name; Document Center only)
--
-- Does NOT own / touch:
--   document_center_files / document_ai_metadata / rag_chunks (Migration 021)
--   compliance retention_policies (complianceCenter Runtime — out of scope)
--
-- Former Runtime DDL:
--   ensureDocumentCenterSchema() V2 mutations — modules/documents/documentCenter.ts
--
-- Rules:
--   Idempotent. Preserve rows. No DROP TABLE. No destructive rewrite.
--   No invent/remap/delete of tenant data. Fail closed on incompatible shapes.
-- Apply AFTER: … → 032
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- A) documents extension columns (baseline remains Migration 003)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=BASELINE_MISSING) — documents table missing; apply Migration 003 first';
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
  udt TEXT;
BEGIN
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='storage_key';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.storage_key udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='storage_provider';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.storage_provider udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='checksum';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.checksum udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='version';
  IF udt IS DISTINCT FROM 'int4' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.version udt=%; expected int4', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='is_archived';
  IF udt IS DISTINCT FROM 'bool' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.is_archived udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='legal_category';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.legal_category udt=%', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='tags';
  IF udt IS DISTINCT FROM '_text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.tags udt=%; expected _text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='migrated_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.migrated_at udt=%; expected timestamptz', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='documents' AND c.column_name='file_size';
  IF udt IS DISTINCT FROM 'int8' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — documents.file_size udt=%; expected int8', udt;
  END IF;
END $$;

ALTER TABLE documents ALTER COLUMN storage_provider SET DEFAULT 'db_base64';
ALTER TABLE documents ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE documents ALTER COLUMN is_archived SET DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════════
-- B) document_versions
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_versions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_id      TEXT NOT NULL,
  office_id        TEXT NOT NULL,
  version_number   INT  NOT NULL DEFAULT 1,
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

DO $$
DECLARE
  udt TEXT;
  null_cnt BIGINT;
  has_pk BOOLEAN;
BEGIN
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_versions' AND c.column_name='id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_versions.id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_versions' AND c.column_name='document_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_versions.document_id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_versions' AND c.column_name='office_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_versions.office_id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_versions' AND c.column_name='version_number';
  IF udt IS DISTINCT FROM 'int4' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_versions.version_number udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_versions' AND c.column_name='file_size';
  IF udt IS DISTINCT FROM 'int8' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_versions.file_size udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_versions' AND c.column_name='is_current';
  IF udt IS DISTINCT FROM 'bool' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_versions.is_current udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_versions' AND c.column_name='created_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_versions.created_at udt=%', udt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM document_versions WHERE document_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_versions.document_id NULL', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM document_versions WHERE office_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_versions.office_id NULL', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM document_versions WHERE version_number IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_versions.version_number NULL', null_cnt;
  END IF;

  ALTER TABLE document_versions ALTER COLUMN document_id SET NOT NULL;
  ALTER TABLE document_versions ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE document_versions ALTER COLUMN version_number SET NOT NULL;
  ALTER TABLE document_versions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  ALTER TABLE document_versions ALTER COLUMN version_number SET DEFAULT 1;
  ALTER TABLE document_versions ALTER COLUMN storage_provider SET DEFAULT 'cloudflare_r2';
  ALTER TABLE document_versions ALTER COLUMN file_size SET DEFAULT 0;
  ALTER TABLE document_versions ALTER COLUMN is_current SET DEFAULT false;
  ALTER TABLE document_versions ALTER COLUMN created_at SET DEFAULT NOW();

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_versions'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM document_versions WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on document_versions';
    END IF;
    ALTER TABLE document_versions ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_versions'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
  ) THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — document_versions PK is not solely (id)';
  END IF;
END $$;

DO $$
DECLARE
  idx_exists BOOLEAN;
  idx_partial BOOLEAN;
  idx_valid BOOLEAN;
  idx_cols TEXT[];
BEGIN
  -- idx_dv_doc_id: (document_id)
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'document_versions' AND i.relname = 'idx_dv_doc_id'
  LIMIT 1;
  IF NOT FOUND THEN idx_exists := false; END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_valid IS NOT TRUE OR idx_cols IS DISTINCT FROM ARRAY['document_id']::text[] THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_dv_doc_id incompatible (cols=% partial=% valid=%). No DROP INDEX.',
        idx_cols, idx_partial, idx_valid;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_dv_doc_id ON document_versions (document_id);
  END IF;

  -- idx_dv_doc_ver: (document_id, version_number)
  idx_exists := false;
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'document_versions' AND i.relname = 'idx_dv_doc_ver'
  LIMIT 1;
  IF NOT FOUND THEN idx_exists := false; END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_valid IS NOT TRUE OR idx_cols IS DISTINCT FROM ARRAY['document_id','version_number']::text[] THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_dv_doc_ver incompatible (cols=% partial=% valid=%). No DROP INDEX.',
        idx_cols, idx_partial, idx_valid;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_dv_doc_ver ON document_versions (document_id, version_number);
  END IF;

  -- idx_dv_office: (office_id)
  idx_exists := false;
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'document_versions' AND i.relname = 'idx_dv_office'
  LIMIT 1;
  IF NOT FOUND THEN idx_exists := false; END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_valid IS NOT TRUE OR idx_cols IS DISTINCT FROM ARRAY['office_id']::text[] THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_dv_office incompatible (cols=% partial=% valid=%). No DROP INDEX.',
        idx_cols, idx_partial, idx_valid;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_dv_office ON document_versions (office_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- C) document_permissions
-- ═══════════════════════════════════════════════════════════════════════════
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

DO $$
DECLARE
  udt TEXT;
  null_cnt BIGINT;
  has_pk BOOLEAN;
BEGIN
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_permissions' AND c.column_name='id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_permissions.id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_permissions' AND c.column_name='document_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_permissions.document_id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_permissions' AND c.column_name='office_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_permissions.office_id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_permissions' AND c.column_name='permission_type';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_permissions.permission_type udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_permissions' AND c.column_name='created_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_permissions.created_at udt=%', udt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM document_permissions WHERE document_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_permissions.document_id NULL', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM document_permissions WHERE office_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_permissions.office_id NULL', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM document_permissions WHERE permission_type IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_permissions.permission_type NULL', null_cnt;
  END IF;

  ALTER TABLE document_permissions ALTER COLUMN document_id SET NOT NULL;
  ALTER TABLE document_permissions ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE document_permissions ALTER COLUMN permission_type SET NOT NULL;
  ALTER TABLE document_permissions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  ALTER TABLE document_permissions ALTER COLUMN permission_type SET DEFAULT 'TEAM';
  ALTER TABLE document_permissions ALTER COLUMN created_at SET DEFAULT NOW();

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_permissions'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM document_permissions WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on document_permissions';
    END IF;
    ALTER TABLE document_permissions ADD CONSTRAINT document_permissions_pkey PRIMARY KEY (id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_permissions'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
  ) THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — document_permissions PK is not solely (id)';
  END IF;
END $$;

DO $$
DECLARE
  idx_exists BOOLEAN;
  idx_partial BOOLEAN;
  idx_valid BOOLEAN;
  idx_cols TEXT[];
BEGIN
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'document_permissions' AND i.relname = 'idx_dp_doc_id'
  LIMIT 1;
  IF NOT FOUND THEN idx_exists := false; END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_valid IS NOT TRUE OR idx_cols IS DISTINCT FROM ARRAY['document_id']::text[] THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_dp_doc_id incompatible (cols=% partial=% valid=%). No DROP INDEX.',
        idx_cols, idx_partial, idx_valid;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_dp_doc_id ON document_permissions (document_id);
  END IF;

  idx_exists := false;
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'document_permissions' AND i.relname = 'idx_dp_office'
  LIMIT 1;
  IF NOT FOUND THEN idx_exists := false; END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_valid IS NOT TRUE OR idx_cols IS DISTINCT FROM ARRAY['office_id']::text[] THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_dp_office incompatible (cols=% partial=% valid=%). No DROP INDEX.',
        idx_cols, idx_partial, idx_valid;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_dp_office ON document_permissions (office_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- D) storage_migration_log  (no invented UNIQUE for ON CONFLICT)
-- ═══════════════════════════════════════════════════════════════════════════
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

DO $$
DECLARE
  udt TEXT;
  null_cnt BIGINT;
  has_pk BOOLEAN;
BEGIN
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='storage_migration_log' AND c.column_name='id';
  IF udt IS DISTINCT FROM 'int4' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — storage_migration_log.id udt=%; expected int4 (SERIAL)', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='storage_migration_log' AND c.column_name='office_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — storage_migration_log.office_id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='storage_migration_log' AND c.column_name='table_name';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — storage_migration_log.table_name udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='storage_migration_log' AND c.column_name='record_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — storage_migration_log.record_id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='storage_migration_log' AND c.column_name='file_size';
  IF udt IS DISTINCT FROM 'int8' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — storage_migration_log.file_size udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='storage_migration_log' AND c.column_name='migrated_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — storage_migration_log.migrated_at udt=%', udt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM storage_migration_log WHERE office_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % storage_migration_log.office_id NULL', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM storage_migration_log WHERE table_name IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % storage_migration_log.table_name NULL', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM storage_migration_log WHERE record_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % storage_migration_log.record_id NULL', null_cnt;
  END IF;

  ALTER TABLE storage_migration_log ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE storage_migration_log ALTER COLUMN table_name SET NOT NULL;
  ALTER TABLE storage_migration_log ALTER COLUMN record_id SET NOT NULL;
  ALTER TABLE storage_migration_log ALTER COLUMN old_provider SET DEFAULT 'db_base64';
  ALTER TABLE storage_migration_log ALTER COLUMN status SET DEFAULT 'pending';
  ALTER TABLE storage_migration_log ALTER COLUMN migrated_at SET DEFAULT NOW();

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.storage_migration_log'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — storage_migration_log missing PK on id';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.storage_migration_log'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
  ) THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — storage_migration_log PK is not solely (id)';
  END IF;
END $$;

DO $$
DECLARE
  idx_exists BOOLEAN;
  idx_partial BOOLEAN;
  idx_valid BOOLEAN;
  idx_cols TEXT[];
BEGIN
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'storage_migration_log' AND i.relname = 'idx_sml_office_status'
  LIMIT 1;
  IF NOT FOUND THEN idx_exists := false; END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_valid IS NOT TRUE OR idx_cols IS DISTINCT FROM ARRAY['office_id','status']::text[] THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_sml_office_status incompatible (cols=% partial=% valid=%). No DROP INDEX.',
        idx_cols, idx_partial, idx_valid;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_sml_office_status ON storage_migration_log (office_id, status);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- E) document_retention_policies (NEW — does not touch retention_policies)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_retention_policies (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id          TEXT NOT NULL,
  category           TEXT NOT NULL,
  retention_years    INT  NOT NULL DEFAULT 7,
  archive_after_days INT DEFAULT 365,
  auto_delete        BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT document_retention_policies_office_id_category_key UNIQUE (office_id, category)
);

ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS retention_years INT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS archive_after_days INT;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS auto_delete BOOLEAN;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE document_retention_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

DO $$
DECLARE
  udt TEXT;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  has_pk BOOLEAN;
  has_unique BOOLEAN;
  wrong_unique BOOLEAN;
BEGIN
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_retention_policies' AND c.column_name='id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_retention_policies.id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_retention_policies' AND c.column_name='office_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_retention_policies.office_id udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_retention_policies' AND c.column_name='category';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_retention_policies.category udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_retention_policies' AND c.column_name='retention_years';
  IF udt IS DISTINCT FROM 'int4' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_retention_policies.retention_years udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_retention_policies' AND c.column_name='archive_after_days';
  IF udt IS DISTINCT FROM 'int4' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_retention_policies.archive_after_days udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_retention_policies' AND c.column_name='auto_delete';
  IF udt IS DISTINCT FROM 'bool' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_retention_policies.auto_delete udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_retention_policies' AND c.column_name='created_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_retention_policies.created_at udt=%', udt;
  END IF;
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='document_retention_policies' AND c.column_name='updated_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — document_retention_policies.updated_at udt=%', udt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM document_retention_policies WHERE office_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_retention_policies.office_id NULL', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM document_retention_policies WHERE category IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_retention_policies.category NULL', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM document_retention_policies WHERE retention_years IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — % document_retention_policies.retention_years NULL', null_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id, category FROM document_retention_policies
    GROUP BY office_id, category HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_RETENTION_KEY) — % duplicate (office_id, category) group(s); no auto-merge', dup_cnt;
  END IF;

  ALTER TABLE document_retention_policies ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE document_retention_policies ALTER COLUMN category SET NOT NULL;
  ALTER TABLE document_retention_policies ALTER COLUMN retention_years SET NOT NULL;
  ALTER TABLE document_retention_policies ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  ALTER TABLE document_retention_policies ALTER COLUMN retention_years SET DEFAULT 7;
  ALTER TABLE document_retention_policies ALTER COLUMN archive_after_days SET DEFAULT 365;
  ALTER TABLE document_retention_policies ALTER COLUMN auto_delete SET DEFAULT false;
  ALTER TABLE document_retention_policies ALTER COLUMN created_at SET DEFAULT NOW();
  ALTER TABLE document_retention_policies ALTER COLUMN updated_at SET DEFAULT NOW();

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_retention_policies'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM document_retention_policies WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on document_retention_policies';
    END IF;
    ALTER TABLE document_retention_policies ADD CONSTRAINT document_retention_policies_pkey PRIMARY KEY (id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_retention_policies'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) ILIKE '%(id)%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%,%'
  ) THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — document_retention_policies PK is not solely (id)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_retention_policies'::regclass
      AND c.contype IN ('u', 'p')
      AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*category\)'
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.document_retention_policies'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indnkeyatts = 2
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped AND a.attname = 'office_id'
      )
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[1]
          AND NOT a.attisdropped AND a.attname = 'category'
      )
  ) INTO has_unique;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_retention_policies'::regclass
      AND c.contype = 'u'
      AND c.conname = 'document_retention_policies_office_id_category_key'
      AND pg_get_constraintdef(c.oid) !~* '\(office_id,\s*category\)'
  ) INTO wrong_unique;
  IF wrong_unique THEN
    RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — document_retention_policies_office_id_category_key wrong shape';
  END IF;

  IF NOT has_unique THEN
    ALTER TABLE document_retention_policies
      ADD CONSTRAINT document_retention_policies_office_id_category_key UNIQUE (office_id, category);
  END IF;
END $$;

DO $$
DECLARE
  idx_exists BOOLEAN;
  idx_partial BOOLEAN;
  idx_valid BOOLEAN;
  idx_cols TEXT[];
BEGIN
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'document_retention_policies' AND i.relname = 'idx_drp_office'
  LIMIT 1;
  IF NOT FOUND THEN idx_exists := false; END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_valid IS NOT TRUE OR idx_cols IS DISTINCT FROM ARRAY['office_id']::text[] THEN
      RAISE EXCEPTION '033_document_v2: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_drp_office incompatible (cols=% partial=% valid=%). No DROP INDEX.',
        idx_cols, idx_partial, idx_valid;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_drp_office ON document_retention_policies (office_id);
  END IF;
END $$;

-- Seed Document Center __default__ categories (idempotent; never touches compliance retention_policies)
INSERT INTO document_retention_policies (office_id, category, retention_years, archive_after_days)
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
-- Post-apply readiness (before COMMIT)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  missing TEXT := NULL;
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — documents missing';
  END IF;
  IF to_regclass('public.document_versions') IS NULL
     OR to_regclass('public.document_permissions') IS NULL
     OR to_regclass('public.storage_migration_log') IS NULL
     OR to_regclass('public.document_retention_policies') IS NULL THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — required V2 table missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='storage_key' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='storage_provider' AND udt_name='text'
      AND column_default ILIKE '%db_base64%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='version' AND udt_name='int4'
      AND column_default ILIKE '%1%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='is_archived' AND udt_name='bool'
      AND column_default ILIKE '%false%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='file_size' AND udt_name='int8'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='tags' AND udt_name='_text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='migrated_at' AND udt_name='timestamptz'
  ) THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — documents extension columns/defaults incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_versions' AND indexname='idx_dv_doc_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_versions' AND indexname='idx_dv_doc_ver'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_versions' AND indexname='idx_dv_office'
  ) THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — document_versions indexes missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_permissions' AND indexname='idx_dp_doc_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_permissions' AND indexname='idx_dp_office'
  ) THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — document_permissions indexes missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='storage_migration_log' AND indexname='idx_sml_office_status'
  ) THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — storage_migration_log index missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.document_retention_policies'::regclass
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*category\)'
  ) THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — document_retention_policies UNIQUE(office_id, category) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='document_retention_policies' AND indexname='idx_drp_office'
  ) THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — document_retention_policies office index missing';
  END IF;

  IF (SELECT COUNT(*) FROM document_retention_policies WHERE office_id = '__default__') < 13 THEN
    RAISE EXCEPTION '033_document_v2: POST_APPLY_READINESS_FAILED — __default__ retention seed incomplete';
  END IF;

  -- Must not have mutated compliance retention_policies schema as part of this migration.
  -- (Presence/shape of retention_policies is out of scope; only assert we did not require it.)
  RAISE NOTICE '033_document_v2: post-apply readiness gate passed (documents cols + V2 tables + document_retention_policies)';
END $$;

COMMIT;
