-- ═══════════════════════════════════════════════════════════════════════════
-- 007_office_storage_quota_text_tenant.sql
-- Align office_storage_quota.office_id with the TEXT tenant model.
--
-- Architecture:
--   - req.tenantId is the canonical storage tenant key (trial_* or permanent TEXT)
--   - office_page UUID is marketplace-only and must NOT identify storage tenants
--   - ON CONFLICT (office_id) requires UNIQUE/PRIMARY KEY on office_id
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006
-- Idempotent: safe to run multiple times. Preserves existing rows.
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Create table if missing (TEXT tenant key) ───────────────────────────
CREATE TABLE IF NOT EXISTS office_storage_quota (
  office_id    TEXT PRIMARY KEY,
  used_bytes   BIGINT NOT NULL DEFAULT 0,
  files_count  INTEGER NOT NULL DEFAULT 0,
  max_bytes    BIGINT NOT NULL DEFAULT 1073741824,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Ensure expected columns exist (legacy tables may be partial) ────────
ALTER TABLE office_storage_quota
  ADD COLUMN IF NOT EXISTS used_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE office_storage_quota
  ADD COLUMN IF NOT EXISTS files_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE office_storage_quota
  ADD COLUMN IF NOT EXISTS max_bytes BIGINT NOT NULL DEFAULT 1073741824;
ALTER TABLE office_storage_quota
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── 3. Drop any FK from office_id → office_page (or other parents) ─────────
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
      AND t.relname = 'office_storage_quota'
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE office_storage_quota DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ── 4. Convert office_id to TEXT if currently UUID (or other non-text) ─────
DO $$
DECLARE
  col_udt text;
BEGIN
  SELECT c.udt_name INTO col_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'office_storage_quota'
    AND c.column_name = 'office_id';

  IF col_udt IS NULL THEN
    RAISE EXCEPTION 'office_storage_quota.office_id column missing after CREATE';
  END IF;

  IF col_udt = 'uuid' THEN
    ALTER TABLE office_storage_quota
      ALTER COLUMN office_id TYPE TEXT USING office_id::text;
  ELSIF col_udt <> 'text' THEN
    -- varchar/citext/etc. → text (preserves values)
    ALTER TABLE office_storage_quota
      ALTER COLUMN office_id TYPE TEXT USING office_id::text;
  END IF;
END $$;

-- ── 5. Ensure UNIQUE or PRIMARY KEY on office_id for ON CONFLICT ───────────
DO $$
DECLARE
  has_office_id_unique boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'office_storage_quota'
      AND c.contype IN ('p', 'u')
      AND pg_get_constraintdef(c.oid) ILIKE '%(office_id)%'
  ) OR EXISTS (
    SELECT 1
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'office_storage_quota'
      AND ix.indisunique
      AND pg_get_indexdef(ix.indexrelid) ILIKE '%(office_id)%'
  ) INTO has_office_id_unique;

  IF NOT has_office_id_unique THEN
    -- Prefer UNIQUE if a different PK already exists on another column.
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'office_storage_quota'
        AND c.contype = 'p'
    ) THEN
      ALTER TABLE office_storage_quota
        ADD CONSTRAINT office_storage_quota_office_id_key UNIQUE (office_id);
    ELSE
      ALTER TABLE office_storage_quota
        ADD CONSTRAINT office_storage_quota_pkey PRIMARY KEY (office_id);
    END IF;
  END IF;
END $$;

COMMIT;
