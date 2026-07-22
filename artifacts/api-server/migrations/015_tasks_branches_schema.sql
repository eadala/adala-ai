-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 015: Tasks + Branches schema (Schema Authority Batch — Tasks / Branches)
--
-- Owns:
--   office_branches
--   tasks (office/legal tasks; not bk_tasks)
--   branch_id columns on cases, clients, client_invoices, tasks
--   office_branches indexes
--   tasks indexes deferred from 010 and moved from cases.ts
--   branch partial indexes formerly created by branches.ts
--
-- Source of truth (former Runtime DDL):
--   ensureTables() — artifacts/api-server/src/modules/platform/branches.ts
--   task related indexes — artifacts/api-server/src/modules/legal-core/cases.ts
--
-- Column types: ASSUMED for existing columns (ADD COLUMN IF NOT EXISTS does not
-- rewrite types). No automatic CAST/rewrite of production data.
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS (no NOT NULL force)
--   - FK skipped with WARNING if legacy data or types would fail
--   - column repairs still COMMIT when FK enforcement is skipped
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION pg_temp.add_015_tb_fk(
  child_table TEXT,
  constraint_name TEXT,
  child_column TEXT,
  parent_table TEXT,
  parent_column TEXT,
  on_delete_sql TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  orphan_cnt BIGINT;
  child_udt TEXT;
  parent_udt TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = format('public.%I', child_table)::regclass
      AND contype = 'f'
      AND conname = constraint_name
  ) THEN
    RETURN;
  END IF;

  SELECT c.udt_name INTO child_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = child_table
    AND c.column_name = child_column;

  SELECT c.udt_name INTO parent_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = parent_table
    AND c.column_name = parent_column;

  IF child_udt IS NULL OR parent_udt IS NULL THEN
    RAISE WARNING
      '015_tb: skipping % FK to % — missing column(s)',
      child_table, parent_table;
    RETURN;
  END IF;

  IF child_udt IS DISTINCT FROM parent_udt THEN
    RAISE WARNING
      '015_tb: skipping % FK to % — incompatible types %.% (%) vs %.% (%); cleanup required (no automatic cast)',
      child_table, parent_table, child_table, child_column, child_udt, parent_table, parent_column, parent_udt;
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM %I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I p WHERE p.%I = c.%I)',
    child_table, child_column, parent_table, parent_column, child_column
  ) INTO orphan_cnt;

  IF orphan_cnt > 0 THEN
    RAISE WARNING
      '015_tb: skipping % FK to % — % orphan row(s); cleanup required',
      child_table, parent_table, orphan_cnt;
  ELSE
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s',
      child_table, constraint_name, child_column, parent_table, parent_column, on_delete_sql
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN foreign_key_violation THEN
    RAISE WARNING '015_tb: skipping % FK to % — foreign_key_violation on legacy data', child_table, parent_table;
  WHEN datatype_mismatch THEN
    RAISE WARNING '015_tb: skipping % FK to % — datatype_mismatch; no automatic cast', child_table, parent_table;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) office_branches
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS office_branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  code            TEXT,
  location        TEXT,
  description     TEXT,
  phone           TEXT,
  email           TEXT,
  manager_user_id TEXT,
  manager_name    TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS manager_user_id TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE office_branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE office_branches ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE office_branches ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE office_branches ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE office_branches ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_office_branches_office ON office_branches(office_id);
CREATE INDEX IF NOT EXISTS idx_office_branches_status ON office_branches(office_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) tasks (office/legal tasks)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id     TEXT,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'todo',
  priority      TEXT NOT NULL DEFAULT 'medium',
  assignee_name TEXT,
  assigned_to   TEXT,
  due_date      DATE,
  case_id       TEXT,
  case_title    TEXT,
  created_by    TEXT,
  tags          TEXT[],
  branch_id     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_name TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS case_title TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE tasks ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'todo';
ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'medium';
ALTER TABLE tasks ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE tasks ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tasks_office_due ON tasks(office_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_office_case ON tasks(office_id, case_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) Branch columns on legal/platform tables
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE cases ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS branch_id UUID;

CREATE INDEX IF NOT EXISTS idx_cases_branch ON cases(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_branch ON clients(branch_id) WHERE branch_id IS NOT NULL;

DO $$ BEGIN
  PERFORM pg_temp.add_015_tb_fk('cases', 'cases_branch_id_fkey', 'branch_id', 'office_branches', 'id', 'SET NULL');
  PERFORM pg_temp.add_015_tb_fk('clients', 'clients_branch_id_fkey', 'branch_id', 'office_branches', 'id', 'SET NULL');
  PERFORM pg_temp.add_015_tb_fk('client_invoices', 'client_invoices_branch_id_fkey', 'branch_id', 'office_branches', 'id', 'SET NULL');
  PERFORM pg_temp.add_015_tb_fk('tasks', 'tasks_branch_id_fkey', 'branch_id', 'office_branches', 'id', 'SET NULL');
END $$;

COMMIT;
