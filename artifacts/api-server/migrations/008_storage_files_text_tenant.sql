-- ═══════════════════════════════════════════════════════════════════════════
-- 008_storage_files_text_tenant.sql
-- Formal CREATE for public.storage_files used by POST /api/storage/files.
--
-- Root cause (Production 42P01): table was never in migrations 001–007 /
-- Drizzle baseline; Runtime DDL never created it either.
--
-- Architecture:
--   - office_id is TEXT tenant key (trial_* or permanent) — matches req.tenantId
--   - id is UUID (handlers cast id::uuid)
--   - No FK to office_page (marketplace UUID must not gate storage)
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007
-- Idempotent: safe to run multiple times. Preserves existing rows.
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS storage_files (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id      TEXT NOT NULL,
  case_id        TEXT,
  client_id      TEXT,
  folder_id      UUID,
  uploaded_by    TEXT,
  original_name  TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  mime_type      TEXT,
  file_size      BIGINT NOT NULL DEFAULT 0,
  file_hash      TEXT,
  file_url       TEXT,
  storage_key    TEXT,
  category       TEXT NOT NULL DEFAULT 'document',
  is_archived    BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at    TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist on any legacy partial table (preserve data)
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS folder_id UUID;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS is_archived BOOLEAN;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE storage_files ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Align office_id to TEXT if a legacy UUID column exists
DO $$
DECLARE
  col_udt text;
BEGIN
  SELECT c.udt_name INTO col_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'storage_files'
    AND c.column_name = 'office_id';

  IF col_udt = 'uuid' THEN
    ALTER TABLE storage_files
      ALTER COLUMN office_id TYPE TEXT USING office_id::text;
  ELSIF col_udt IS NOT NULL AND col_udt <> 'text' THEN
    ALTER TABLE storage_files
      ALTER COLUMN office_id TYPE TEXT USING office_id::text;
  END IF;
END $$;

-- Drop FKs that would reject trial_* tenant keys (e.g. → office_page)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'storage_files'
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE storage_files DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Sensible defaults for nullable legacy columns used as NOT NULL in app paths
UPDATE storage_files SET original_name = COALESCE(original_name, file_name, 'file')
  WHERE original_name IS NULL;
UPDATE storage_files SET file_name = COALESCE(file_name, original_name, 'file')
  WHERE file_name IS NULL;
UPDATE storage_files SET file_size = 0 WHERE file_size IS NULL;
UPDATE storage_files SET category = 'document' WHERE category IS NULL;
UPDATE storage_files SET is_archived = FALSE WHERE is_archived IS NULL;
UPDATE storage_files SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE storage_files SET created_at = NOW() WHERE created_at IS NULL;
UPDATE storage_files SET updated_at = NOW() WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_storage_files_office_id
  ON storage_files (office_id);

CREATE INDEX IF NOT EXISTS idx_storage_files_office_hash
  ON storage_files (office_id, file_hash)
  WHERE file_hash IS NOT NULL AND NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_storage_files_folder_id
  ON storage_files (folder_id)
  WHERE folder_id IS NOT NULL;

COMMIT;
