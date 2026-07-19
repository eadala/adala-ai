-- ═══════════════════════════════════════════════════════════════════════════
-- 009_storage_folders.sql
-- Formal CREATE for public.storage_folders (+ folder_permissions) used by the
-- Documents Library "Folder management" feature in
-- artifacts/api-server/src/modules/operations/storage.ts.
--
-- Root cause (Production): table was never in migrations 001–008 / Drizzle
-- baseline; Runtime DDL never created it either. POST /api/storage/folders
-- inserted through a local dbRows() helper that swallows every DB error and
-- returns [] — so the missing-relation error (42P01) was discarded and the
-- route replied HTTP 200 with an empty body (res.json(rows[0]) === undefined),
-- which crashes Safari's Response.json() with
-- "The string did not match the expected pattern."
--
-- Schema derived strictly from actual query usage in storage.ts:
--   storage_folders: id, office_id, parent_id, name, visibility, created_by,
--     created_at, updated_at
--       - f.id, f.parent_id, f.name, f.visibility, f.created_by, f.created_at (list)
--       - office_id=... (list/create/rename/delete/permissions, all scoped by tenant)
--       - parent_id::text / parent_id (dup-check, nested create, delete reparent)
--       - name (create/rename), created_by (owner checks), visibility (custom/owner_only/admins_only/everyone)
--       - updated_at=NOW() (rename, visibility PATCH)
--   folder_permissions: folder_id, user_id, user_name, can_read, can_write,
--     can_delete, granted_at
--       - SELECT can_read, can_write ... WHERE folder_id=... AND user_id=... (getFolderAccess "custom")
--       - SELECT fp.user_id, fp.user_name, fp.can_read, fp.can_write, fp.can_delete, fp.granted_at ...
--       - INSERT ... ON CONFLICT (folder_id, user_id) DO UPDATE ... RETURNING * (grant/update)
--       - DELETE ... WHERE folder_id=... AND user_id=... (revoke)
--
-- Architecture (matches 007/008 precedent):
--   - office_id is TEXT tenant key (trial_* or permanent) — matches req.tenantId
--   - id is UUID (handlers cast id::uuid); parent_id is UUID, no FK (self-
--     reference) to avoid rejecting rows on partial/legacy data, consistent
--     with storage_files.folder_id having no FK to storage_folders (008)
--   - folder_permissions.folder_id has no FK either, for the same reason
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008
-- Idempotent: safe to run multiple times. Preserves existing rows.
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. storage_folders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS storage_folders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  parent_id    UUID,
  name         TEXT NOT NULL,
  visibility   TEXT NOT NULL DEFAULT 'everyone',
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist on any legacy partial table (preserve data)
ALTER TABLE storage_folders ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE storage_folders ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE storage_folders ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE storage_folders ADD COLUMN IF NOT EXISTS visibility TEXT;
ALTER TABLE storage_folders ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE storage_folders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE storage_folders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Align office_id to TEXT if a legacy UUID (or other) column exists
DO $$
DECLARE
  col_udt text;
BEGIN
  SELECT c.udt_name INTO col_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'storage_folders'
    AND c.column_name = 'office_id';

  IF col_udt = 'uuid' THEN
    ALTER TABLE storage_folders
      ALTER COLUMN office_id TYPE TEXT USING office_id::text;
  ELSIF col_udt IS NOT NULL AND col_udt <> 'text' THEN
    ALTER TABLE storage_folders
      ALTER COLUMN office_id TYPE TEXT USING office_id::text;
  END IF;
END $$;

-- Drop FKs that would reject trial_* tenant keys or partial legacy data
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
      AND t.relname = 'storage_folders'
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE storage_folders DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Sensible defaults for nullable legacy columns used as NOT NULL in app paths
UPDATE storage_folders SET name = COALESCE(name, 'مجلد') WHERE name IS NULL;
UPDATE storage_folders SET visibility = 'everyone' WHERE visibility IS NULL;
UPDATE storage_folders SET created_at = NOW() WHERE created_at IS NULL;
UPDATE storage_folders SET updated_at = NOW() WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_storage_folders_office_id
  ON storage_folders (office_id);

CREATE INDEX IF NOT EXISTS idx_storage_folders_parent_id
  ON storage_folders (parent_id)
  WHERE parent_id IS NOT NULL;

-- ── 2. folder_permissions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folder_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   UUID NOT NULL,
  user_id     TEXT NOT NULL,
  user_name   TEXT,
  can_read    BOOLEAN NOT NULL DEFAULT TRUE,
  can_write   BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete  BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE folder_permissions ADD COLUMN IF NOT EXISTS folder_id UUID;
ALTER TABLE folder_permissions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE folder_permissions ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE folder_permissions ADD COLUMN IF NOT EXISTS can_read BOOLEAN;
ALTER TABLE folder_permissions ADD COLUMN IF NOT EXISTS can_write BOOLEAN;
ALTER TABLE folder_permissions ADD COLUMN IF NOT EXISTS can_delete BOOLEAN;
ALTER TABLE folder_permissions ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ;

-- Drop FKs for the same partial-legacy-data reason as storage_folders above
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
      AND t.relname = 'folder_permissions'
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE folder_permissions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE folder_permissions SET can_read = TRUE WHERE can_read IS NULL;
UPDATE folder_permissions SET can_write = FALSE WHERE can_write IS NULL;
UPDATE folder_permissions SET can_delete = FALSE WHERE can_delete IS NULL;
UPDATE folder_permissions SET granted_at = NOW() WHERE granted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folder_permissions_folder_id
  ON folder_permissions (folder_id);

-- ON CONFLICT (folder_id, user_id) DO UPDATE requires a UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'folder_permissions'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(folder_id, user_id)%'
  ) THEN
    ALTER TABLE folder_permissions
      ADD CONSTRAINT folder_permissions_folder_id_user_id_key UNIQUE (folder_id, user_id);
  END IF;
END $$;

COMMIT;
