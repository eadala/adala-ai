-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 016: Office Messages FTS (Schema Authority Batch — FTS / Office Messages)
--
-- Owns:
--   office_messages base table required by internal message FTS
--   office_messages FTS-facing columns
--   office_messages.search_vector generated tsvector
--   idx_messages_search GIN index
--
-- Source of truth (former Runtime DDL):
--   ensureFullTextSearch() — artifacts/api-server/src/modules/operations/internal-messages.ts
--
-- Column types: ASSUMED for existing columns (ADD COLUMN IF NOT EXISTS does not
-- rewrite types). No automatic CAST/rewrite of production data.
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS (no NOT NULL force)
--   - search_vector uses arabic text search config when present, otherwise simple
--   - incompatible legacy search_vector columns are skipped with WARNING
--   - FTS repairs still COMMIT when generated column/index creation is skipped
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) office_messages base table (minimal columns used by internal messages)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS office_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       TEXT,
  subject         TEXT,
  body            TEXT,
  sender_id       TEXT,
  sender_name     TEXT,
  sender_ip       TEXT,
  device_info     TEXT,
  folder          TEXT,
  tags            TEXT[],
  case_id         INTEGER,
  conversation_id UUID,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) Column repair for legacy / partial office_messages tables
--    (must run BEFORE search_vector so subject/body exist in one apply)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS sender_id TEXT;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS sender_ip TEXT;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS folder TEXT;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS case_id INTEGER;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE office_messages ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE office_messages ALTER COLUMN created_at SET DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) Generated FTS vector (arabic when available, simple otherwise)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  fts_cfg TEXT;
  existing_udt TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'office_messages'
  ) THEN
    RAISE WARNING '016_fts: skipping search_vector — office_messages missing';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'office_messages'
      AND column_name = 'subject'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'office_messages'
      AND column_name = 'body'
  ) THEN
    RAISE WARNING '016_fts: skipping search_vector — subject or body missing';
    RETURN;
  END IF;

  SELECT c.udt_name INTO existing_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'office_messages'
    AND c.column_name = 'search_vector';

  IF existing_udt IS NOT NULL THEN
    IF existing_udt = 'tsvector' THEN
      RAISE NOTICE '016_fts: search_vector already exists';
    ELSE
      RAISE WARNING '016_fts: skipping search_vector — incompatible existing type';
    END IF;
    RETURN;
  END IF;

  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'arabic') THEN 'arabic'
    ELSE 'simple'
  END INTO fts_cfg;

  EXECUTE format(
    'ALTER TABLE office_messages ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector(%L, coalesce(subject, '''') || '' '' || coalesce(body, ''''))) STORED',
    fts_cfg
  );
EXCEPTION
  WHEN duplicate_column THEN
    RAISE WARNING '016_fts: skipping search_vector — duplicate column';
  WHEN undefined_table THEN
    RAISE WARNING '016_fts: skipping search_vector — office_messages missing';
  WHEN undefined_column THEN
    RAISE WARNING '016_fts: skipping search_vector — subject or body missing';
  WHEN others THEN
    RAISE WARNING '016_fts: skipping search_vector — %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) GIN index for @@ predicates
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'office_messages'
      AND column_name = 'search_vector'
      AND udt_name = 'tsvector'
  ) THEN
    RAISE WARNING '016_fts: skipping idx_messages_search — search_vector missing';
    RETURN;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_messages_search
    ON office_messages USING gin(search_vector);
EXCEPTION
  WHEN undefined_table THEN
    RAISE WARNING '016_fts: skipping idx_messages_search — office_messages missing';
  WHEN undefined_column THEN
    RAISE WARNING '016_fts: skipping idx_messages_search — search_vector missing';
  WHEN others THEN
    RAISE WARNING '016_fts: skipping idx_messages_search — %', SQLERRM;
END $$;

COMMIT;
