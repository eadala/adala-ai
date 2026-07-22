-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 014: Bankruptcy schema (Schema Authority Batch — Bankruptcy)
--
-- Owns:
--   bankruptcy_cases
--   bk_creditors
--   bk_claims
--   bk_claim_documents
--   bk_assets
--   bk_asset_valuations
--   bk_meetings
--   bk_distributions
--   bk_distribution_items
--   bk_reports
--   bk_ai_analysis
--   bk_timeline
--   bk_audit_logs
--   bk_notifications
--   bk_workflows
--   bk_workflow_steps
--   bk_workflow_events
--   bk_tasks
--   bk_task_comments
--   bk_task_assignments
--   bk_templates
--   bk_alerts
--   bk_opening_requests
--   bk_opening_request_documents
--   bk_emergency_locks
--
-- Source of truth (former Runtime DDL):
--   ensureBankruptcyTables()    — artifacts/api-server/src/modules/bankruptcy/bankruptcy.ts
--   ensureBankruptcyV2Tables()  — artifacts/api-server/src/modules/bankruptcy/bankruptcyV2.ts
--   ensureBankruptcyV3Tables()  — artifacts/api-server/src/modules/bankruptcy/bankruptcyV3.ts
--   ensureDemoColumns()         — artifacts/api-server/src/modules/bankruptcy/bankruptcyDemo.ts
--   ensureEocTables()           — artifacts/api-server/src/modules/platform/admin.ts
--
-- Column types: ASSUMED for existing columns (ADD COLUMN IF NOT EXISTS does not
-- rewrite types). No automatic CAST/rewrite of production data.
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS (no NOT NULL force)
--   - UNIQUE / CHECK / FK skipped with WARNING if legacy data would fail
--   - column repairs still COMMIT when enforcement is skipped
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION pg_temp.add_014_bk_check(
  table_name TEXT,
  constraint_name TEXT,
  check_sql TEXT,
  invalid_where_sql TEXT,
  label TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  invalid_cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = format('public.%I', table_name)::regclass
      AND conname = constraint_name
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('SELECT COUNT(*) FROM %I WHERE %s', table_name, invalid_where_sql)
    INTO invalid_cnt;

  IF invalid_cnt > 0 THEN
    RAISE WARNING
      '014_bk: skipping % CHECK — % row(s) invalid; cleanup required',
      label, invalid_cnt;
  ELSE
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s)',
      table_name, constraint_name, check_sql
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN check_violation THEN
    RAISE WARNING '014_bk: skipping % CHECK — check_violation on legacy data', label;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.add_014_bk_unique(
  table_name TEXT,
  constraint_name TEXT,
  columns TEXT[],
  label TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  col_list TEXT;
  not_null_predicate TEXT;
  dup_cnt BIGINT;
BEGIN
  SELECT string_agg(format('%I', c), ', '), string_agg(format('%I IS NOT NULL', c), ' AND ')
    INTO col_list, not_null_predicate
  FROM unnest(columns) AS u(c);

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = format('public.%I', table_name)::regclass
      AND contype = 'u'
      AND conname = constraint_name
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM (SELECT %s FROM %I WHERE %s GROUP BY %s HAVING COUNT(*) > 1) d',
    col_list, table_name, not_null_predicate, col_list
  ) INTO dup_cnt;

  IF dup_cnt > 0 THEN
    RAISE WARNING
      '014_bk: skipping % UNIQUE(%s) — % duplicate value set(s); cleanup required',
      label, col_list, dup_cnt;
  ELSE
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (%s)',
      table_name, constraint_name, col_list
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN unique_violation THEN
    RAISE WARNING '014_bk: skipping % UNIQUE — unique_violation on legacy data', label;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.add_014_bk_fk(
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
      '014_bk: skipping % FK to % — missing column(s)',
      child_table, parent_table;
    RETURN;
  END IF;

  IF child_udt IS DISTINCT FROM parent_udt THEN
    RAISE WARNING
      '014_bk: skipping % FK to % — incompatible types %.% (%) vs %.% (%); cleanup required (no automatic cast)',
      child_table, parent_table, child_table, child_column, child_udt, parent_table, parent_column, parent_udt;
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM %I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I p WHERE p.%I = c.%I)',
    child_table, child_column, parent_table, parent_column, child_column
  ) INTO orphan_cnt;

  IF orphan_cnt > 0 THEN
    RAISE WARNING
      '014_bk: skipping % FK to % — % orphan row(s); cleanup required',
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
    RAISE WARNING '014_bk: skipping % FK to % — foreign_key_violation on legacy data', child_table, parent_table;
  WHEN datatype_mismatch THEN
    RAISE WARNING '014_bk: skipping % FK to % — datatype_mismatch; no automatic cast', child_table, parent_table;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) bankruptcy_cases
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bankruptcy_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       TEXT NOT NULL,
  case_number     TEXT NOT NULL,
  debtor_name     TEXT NOT NULL,
  debtor_type     TEXT NOT NULL DEFAULT 'company'
                    CONSTRAINT bankruptcy_cases_debtor_type_check
                    CHECK (debtor_type IN ('individual','company','partnership')),
  procedure_type  TEXT NOT NULL DEFAULT 'liquidation'
                    CONSTRAINT bankruptcy_cases_procedure_type_check
                    CHECK (procedure_type IN ('liquidation','reorganization','protective_settlement','restructuring')),
  court_name      TEXT,
  trustee_name    TEXT,
  trustee_id      TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CONSTRAINT bankruptcy_cases_status_check
                    CHECK (status IN ('active','suspended','claims_review','asset_management','distribution','closed','archived')),
  notes           TEXT,
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  is_demo         BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT bankruptcy_cases_office_id_case_number_key UNIQUE (office_id, case_number)
);

ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS case_number TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS debtor_name TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS debtor_type TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS procedure_type TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS court_name TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS trustee_name TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS trustee_id TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bankruptcy_cases ALTER COLUMN debtor_type SET DEFAULT 'company';
ALTER TABLE bankruptcy_cases ALTER COLUMN procedure_type SET DEFAULT 'liquidation';
ALTER TABLE bankruptcy_cases ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE bankruptcy_cases ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bankruptcy_cases ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE bankruptcy_cases ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check(
    'bankruptcy_cases',
    'bankruptcy_cases_debtor_type_check',
    'debtor_type IN (''individual'',''company'',''partnership'')',
    'debtor_type IS NOT NULL AND debtor_type NOT IN (''individual'',''company'',''partnership'')',
    'bankruptcy_cases debtor_type'
  );
END $$;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check(
    'bankruptcy_cases',
    'bankruptcy_cases_procedure_type_check',
    'procedure_type IN (''liquidation'',''reorganization'',''protective_settlement'',''restructuring'')',
    'procedure_type IS NOT NULL AND procedure_type NOT IN (''liquidation'',''reorganization'',''protective_settlement'',''restructuring'')',
    'bankruptcy_cases procedure_type'
  );
END $$;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check(
    'bankruptcy_cases',
    'bankruptcy_cases_status_check',
    'status IN (''active'',''suspended'',''claims_review'',''asset_management'',''distribution'',''closed'',''archived'')',
    'status IS NOT NULL AND status NOT IN (''active'',''suspended'',''claims_review'',''asset_management'',''distribution'',''closed'',''archived'')',
    'bankruptcy_cases status'
  );
END $$;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_unique(
    'bankruptcy_cases',
    'bankruptcy_cases_office_id_case_number_key',
    ARRAY['office_id','case_number'],
    'bankruptcy_cases'
  );
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_cases_office ON bankruptcy_cases(office_id);
CREATE INDEX IF NOT EXISTS idx_bk_cases_office_status ON bankruptcy_cases(office_id, status);
CREATE INDEX IF NOT EXISTS idx_bk_cases_office_date ON bankruptcy_cases(office_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) bk_creditors
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_creditors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL CONSTRAINT bk_creditors_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  office_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'unsecured'
                CONSTRAINT bk_creditors_type_check
                CHECK (type IN ('secured','unsecured','preferred','government','subordinated')),
  email       TEXT,
  phone       TEXT,
  national_id TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_creditors ALTER COLUMN type SET DEFAULT 'unsecured';
ALTER TABLE bk_creditors ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_creditors ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE bk_creditors ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check(
    'bk_creditors',
    'bk_creditors_type_check',
    'type IN (''secured'',''unsecured'',''preferred'',''government'',''subordinated'')',
    'type IS NOT NULL AND type NOT IN (''secured'',''unsecured'',''preferred'',''government'',''subordinated'')',
    'bk_creditors type'
  );
  PERFORM pg_temp.add_014_bk_fk('bk_creditors', 'bk_creditors_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_creditors_case ON bk_creditors(case_id);
CREATE INDEX IF NOT EXISTS idx_bk_creditors_office ON bk_creditors(office_id);
CREATE INDEX IF NOT EXISTS idx_bk_creditors_case_off ON bk_creditors(case_id, office_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) bk_claims
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL CONSTRAINT bk_claims_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  creditor_id    UUID NOT NULL CONSTRAINT bk_claims_creditor_id_fkey REFERENCES bk_creditors(id) ON DELETE CASCADE,
  office_id      TEXT NOT NULL,
  claim_number   TEXT,
  amount         NUMERIC(18,2) NOT NULL DEFAULT 0
                   CONSTRAINT bk_claims_amount_check CHECK (amount >= 0),
  currency       TEXT NOT NULL DEFAULT 'SAR'
                   CONSTRAINT bk_claims_currency_check
                   CHECK (currency IN ('SAR','USD','EUR','GBP','AED','KWD','BHD','QAR','OMR')),
  priority_level TEXT NOT NULL DEFAULT 'unsecured'
                   CONSTRAINT bk_claims_priority_level_check
                   CHECK (priority_level IN ('secured','preferred','unsecured','subordinated')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CONSTRAINT bk_claims_status_check
                   CHECK (status IN ('pending','submitted','under_review','approved','partially_approved','rejected','disputed','finalized')),
  submitted_at   DATE,
  reviewed_at    DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  is_demo        BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS creditor_id UUID;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS claim_number TEXT;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS amount NUMERIC(18,2);
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS priority_level TEXT;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS submitted_at DATE;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS reviewed_at DATE;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_claims ALTER COLUMN amount SET DEFAULT 0;
ALTER TABLE bk_claims ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE bk_claims ALTER COLUMN priority_level SET DEFAULT 'unsecured';
ALTER TABLE bk_claims ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE bk_claims ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_claims ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE bk_claims ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_claims', 'bk_claims_amount_check', 'amount >= 0', 'amount IS NOT NULL AND amount < 0', 'bk_claims amount');
  PERFORM pg_temp.add_014_bk_check('bk_claims', 'bk_claims_currency_check', 'currency IN (''SAR'',''USD'',''EUR'',''GBP'',''AED'',''KWD'',''BHD'',''QAR'',''OMR'')', 'currency IS NOT NULL AND currency NOT IN (''SAR'',''USD'',''EUR'',''GBP'',''AED'',''KWD'',''BHD'',''QAR'',''OMR'')', 'bk_claims currency');
  PERFORM pg_temp.add_014_bk_check('bk_claims', 'bk_claims_priority_level_check', 'priority_level IN (''secured'',''preferred'',''unsecured'',''subordinated'')', 'priority_level IS NOT NULL AND priority_level NOT IN (''secured'',''preferred'',''unsecured'',''subordinated'')', 'bk_claims priority_level');
  PERFORM pg_temp.add_014_bk_check('bk_claims', 'bk_claims_status_check', 'status IN (''pending'',''submitted'',''under_review'',''approved'',''partially_approved'',''rejected'',''disputed'',''finalized'')', 'status IS NOT NULL AND status NOT IN (''pending'',''submitted'',''under_review'',''approved'',''partially_approved'',''rejected'',''disputed'',''finalized'')', 'bk_claims status');
  PERFORM pg_temp.add_014_bk_fk('bk_claims', 'bk_claims_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
  PERFORM pg_temp.add_014_bk_fk('bk_claims', 'bk_claims_creditor_id_fkey', 'creditor_id', 'bk_creditors', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_claims_case ON bk_claims(case_id);
CREATE INDEX IF NOT EXISTS idx_bk_claims_office ON bk_claims(office_id);
CREATE INDEX IF NOT EXISTS idx_bk_claims_creditor ON bk_claims(creditor_id);
CREATE INDEX IF NOT EXISTS idx_bk_claims_status ON bk_claims(case_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) bk_claim_documents
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_claim_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     UUID NOT NULL CONSTRAINT bk_claim_documents_claim_id_fkey REFERENCES bk_claims(id) ON DELETE CASCADE,
  office_id    TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  file_url     TEXT,
  uploaded_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_claim_documents ADD COLUMN IF NOT EXISTS claim_id UUID;
ALTER TABLE bk_claim_documents ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_claim_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE bk_claim_documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE bk_claim_documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE bk_claim_documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE bk_claim_documents ALTER COLUMN created_at SET DEFAULT NOW();

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_fk('bk_claim_documents', 'bk_claim_documents_claim_id_fkey', 'claim_id', 'bk_claims', 'id', 'CASCADE');
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) bk_assets
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL CONSTRAINT bk_assets_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  office_id       TEXT NOT NULL,
  asset_name      TEXT NOT NULL,
  asset_type      TEXT NOT NULL DEFAULT 'real_estate'
                    CONSTRAINT bk_assets_asset_type_check
                    CHECK (asset_type IN ('real_estate','vehicle','equipment','inventory','cash','receivables','intellectual','securities','other')),
  description     TEXT,
  estimated_value NUMERIC(18,2) DEFAULT 0
                    CONSTRAINT bk_assets_estimated_value_check CHECK (estimated_value >= 0),
  market_value    NUMERIC(18,2) DEFAULT 0
                    CONSTRAINT bk_assets_market_value_check CHECK (market_value >= 0),
  status          TEXT NOT NULL DEFAULT 'identified'
                    CONSTRAINT bk_assets_status_check
                    CHECK (status IN ('identified','valuation','listed','sold','collected','closed','active')),
  location        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo         BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS asset_name TEXT;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS asset_type TEXT;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(18,2);
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS market_value NUMERIC(18,2);
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_assets ALTER COLUMN asset_type SET DEFAULT 'real_estate';
ALTER TABLE bk_assets ALTER COLUMN estimated_value SET DEFAULT 0;
ALTER TABLE bk_assets ALTER COLUMN market_value SET DEFAULT 0;
ALTER TABLE bk_assets ALTER COLUMN status SET DEFAULT 'identified';
ALTER TABLE bk_assets ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_assets ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE bk_assets ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_assets', 'bk_assets_asset_type_check', 'asset_type IN (''real_estate'',''vehicle'',''equipment'',''inventory'',''cash'',''receivables'',''intellectual'',''securities'',''other'')', 'asset_type IS NOT NULL AND asset_type NOT IN (''real_estate'',''vehicle'',''equipment'',''inventory'',''cash'',''receivables'',''intellectual'',''securities'',''other'')', 'bk_assets asset_type');
  PERFORM pg_temp.add_014_bk_check('bk_assets', 'bk_assets_estimated_value_check', 'estimated_value >= 0', 'estimated_value IS NOT NULL AND estimated_value < 0', 'bk_assets estimated_value');
  PERFORM pg_temp.add_014_bk_check('bk_assets', 'bk_assets_market_value_check', 'market_value >= 0', 'market_value IS NOT NULL AND market_value < 0', 'bk_assets market_value');
  PERFORM pg_temp.add_014_bk_check('bk_assets', 'bk_assets_status_check', 'status IN (''identified'',''valuation'',''listed'',''sold'',''collected'',''closed'',''active'')', 'status IS NOT NULL AND status NOT IN (''identified'',''valuation'',''listed'',''sold'',''collected'',''closed'',''active'')', 'bk_assets status');
  PERFORM pg_temp.add_014_bk_fk('bk_assets', 'bk_assets_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_assets_case ON bk_assets(case_id);
CREATE INDEX IF NOT EXISTS idx_bk_assets_office ON bk_assets(office_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) bk_asset_valuations
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_asset_valuations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         UUID NOT NULL CONSTRAINT bk_asset_valuations_asset_id_fkey REFERENCES bk_assets(id) ON DELETE CASCADE,
  office_id        TEXT NOT NULL,
  valuator_name    TEXT NOT NULL,
  valuation_amount NUMERIC(18,2) NOT NULL DEFAULT 0
                     CONSTRAINT bk_asset_valuations_amount_check CHECK (valuation_amount >= 0),
  valuation_date   DATE,
  report_file      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_asset_valuations ADD COLUMN IF NOT EXISTS asset_id UUID;
ALTER TABLE bk_asset_valuations ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_asset_valuations ADD COLUMN IF NOT EXISTS valuator_name TEXT;
ALTER TABLE bk_asset_valuations ADD COLUMN IF NOT EXISTS valuation_amount NUMERIC(18,2);
ALTER TABLE bk_asset_valuations ADD COLUMN IF NOT EXISTS valuation_date DATE;
ALTER TABLE bk_asset_valuations ADD COLUMN IF NOT EXISTS report_file TEXT;
ALTER TABLE bk_asset_valuations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE bk_asset_valuations ALTER COLUMN valuation_amount SET DEFAULT 0;
ALTER TABLE bk_asset_valuations ALTER COLUMN created_at SET DEFAULT NOW();

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_asset_valuations', 'bk_asset_valuations_amount_check', 'valuation_amount >= 0', 'valuation_amount IS NOT NULL AND valuation_amount < 0', 'bk_asset_valuations valuation_amount');
  PERFORM pg_temp.add_014_bk_fk('bk_asset_valuations', 'bk_asset_valuations_asset_id_fkey', 'asset_id', 'bk_assets', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_asset_vals_asset ON bk_asset_valuations(asset_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7) bk_meetings
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_meetings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL CONSTRAINT bk_meetings_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  office_id    TEXT NOT NULL,
  title        TEXT NOT NULL,
  meeting_date TIMESTAMPTZ,
  location     TEXT,
  meeting_type TEXT NOT NULL DEFAULT 'creditors'
                 CONSTRAINT bk_meetings_meeting_type_check
                 CHECK (meeting_type IN ('creditors','trustee','court','committee','valuation','other')),
  status       TEXT NOT NULL DEFAULT 'scheduled'
                 CONSTRAINT bk_meetings_status_check
                 CHECK (status IN ('scheduled','completed','cancelled')),
  minutes_text TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo      BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS meeting_date TIMESTAMPTZ;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS meeting_type TEXT;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS minutes_text TEXT;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_meetings ALTER COLUMN meeting_type SET DEFAULT 'creditors';
ALTER TABLE bk_meetings ALTER COLUMN status SET DEFAULT 'scheduled';
ALTER TABLE bk_meetings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_meetings ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE bk_meetings ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_meetings', 'bk_meetings_meeting_type_check', 'meeting_type IN (''creditors'',''trustee'',''court'',''committee'',''valuation'',''other'')', 'meeting_type IS NOT NULL AND meeting_type NOT IN (''creditors'',''trustee'',''court'',''committee'',''valuation'',''other'')', 'bk_meetings meeting_type');
  PERFORM pg_temp.add_014_bk_check('bk_meetings', 'bk_meetings_status_check', 'status IN (''scheduled'',''completed'',''cancelled'')', 'status IS NOT NULL AND status NOT IN (''scheduled'',''completed'',''cancelled'')', 'bk_meetings status');
  PERFORM pg_temp.add_014_bk_fk('bk_meetings', 'bk_meetings_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_meetings_case ON bk_meetings(case_id);
CREATE INDEX IF NOT EXISTS idx_bk_meetings_date ON bk_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_bk_meetings_office_date ON bk_meetings(office_id, meeting_date);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8) bk_distributions
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_distributions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL CONSTRAINT bk_distributions_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  office_id          TEXT NOT NULL,
  distribution_round INT NOT NULL DEFAULT 1
                       CONSTRAINT bk_distributions_round_check CHECK (distribution_round > 0),
  total_amount       NUMERIC(18,2) NOT NULL DEFAULT 0
                       CONSTRAINT bk_distributions_total_amount_check CHECK (total_amount > 0),
  distribution_date  DATE,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CONSTRAINT bk_distributions_status_check
                       CHECK (status IN ('draft','approved','executing','executed','cancelled')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo            BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS distribution_round INT;
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS total_amount NUMERIC(18,2);
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS distribution_date DATE;
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_distributions ALTER COLUMN distribution_round SET DEFAULT 1;
ALTER TABLE bk_distributions ALTER COLUMN total_amount SET DEFAULT 0;
ALTER TABLE bk_distributions ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE bk_distributions ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_distributions ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE bk_distributions ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_distributions', 'bk_distributions_round_check', 'distribution_round > 0', 'distribution_round IS NOT NULL AND distribution_round <= 0', 'bk_distributions distribution_round');
  PERFORM pg_temp.add_014_bk_check('bk_distributions', 'bk_distributions_total_amount_check', 'total_amount > 0', 'total_amount IS NOT NULL AND total_amount <= 0', 'bk_distributions total_amount');
  PERFORM pg_temp.add_014_bk_check('bk_distributions', 'bk_distributions_status_check', 'status IN (''draft'',''approved'',''executing'',''executed'',''cancelled'')', 'status IS NOT NULL AND status NOT IN (''draft'',''approved'',''executing'',''executed'',''cancelled'')', 'bk_distributions status');
  PERFORM pg_temp.add_014_bk_fk('bk_distributions', 'bk_distributions_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_distributions_case ON bk_distributions(case_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9) bk_distribution_items
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_distribution_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id  UUID NOT NULL CONSTRAINT bk_distribution_items_distribution_id_fkey REFERENCES bk_distributions(id) ON DELETE CASCADE,
  creditor_id      UUID NOT NULL CONSTRAINT bk_distribution_items_creditor_id_fkey REFERENCES bk_creditors(id) ON DELETE CASCADE,
  claim_id         UUID CONSTRAINT bk_distribution_items_claim_id_fkey REFERENCES bk_claims(id),
  office_id        TEXT NOT NULL,
  allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0
                     CONSTRAINT bk_distribution_items_allocated_amount_check CHECK (allocated_amount >= 0),
  payment_status   TEXT NOT NULL DEFAULT 'pending'
                     CONSTRAINT bk_distribution_items_payment_status_check
                     CHECK (payment_status IN ('pending','processing','paid','failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo          BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS distribution_id UUID;
ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS creditor_id UUID;
ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS claim_id UUID;
ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(18,2);
ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_distribution_items ALTER COLUMN allocated_amount SET DEFAULT 0;
ALTER TABLE bk_distribution_items ALTER COLUMN payment_status SET DEFAULT 'pending';
ALTER TABLE bk_distribution_items ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_distribution_items ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_distribution_items', 'bk_distribution_items_allocated_amount_check', 'allocated_amount >= 0', 'allocated_amount IS NOT NULL AND allocated_amount < 0', 'bk_distribution_items allocated_amount');
  PERFORM pg_temp.add_014_bk_check('bk_distribution_items', 'bk_distribution_items_payment_status_check', 'payment_status IN (''pending'',''processing'',''paid'',''failed'')', 'payment_status IS NOT NULL AND payment_status NOT IN (''pending'',''processing'',''paid'',''failed'')', 'bk_distribution_items payment_status');
  PERFORM pg_temp.add_014_bk_fk('bk_distribution_items', 'bk_distribution_items_distribution_id_fkey', 'distribution_id', 'bk_distributions', 'id', 'CASCADE');
  PERFORM pg_temp.add_014_bk_fk('bk_distribution_items', 'bk_distribution_items_creditor_id_fkey', 'creditor_id', 'bk_creditors', 'id', 'CASCADE');
  PERFORM pg_temp.add_014_bk_fk('bk_distribution_items', 'bk_distribution_items_claim_id_fkey', 'claim_id', 'bk_claims', 'id', 'NO ACTION');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_dist_items_dist ON bk_distribution_items(distribution_id);
CREATE INDEX IF NOT EXISTS idx_bk_dist_items_creditor ON bk_distribution_items(creditor_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10) bk_reports
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL CONSTRAINT bk_reports_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  office_id    TEXT NOT NULL,
  report_type  TEXT NOT NULL DEFAULT 'progress'
                 CONSTRAINT bk_reports_report_type_check
                 CHECK (report_type IN ('progress','financial','assets','claims','trustee','final','court')),
  report_title TEXT NOT NULL,
  content      TEXT,
  generated_by TEXT,
  category     TEXT DEFAULT 'general',
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo      BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS report_type TEXT;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS report_title TEXT;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS generated_by TEXT;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_reports ALTER COLUMN report_type SET DEFAULT 'progress';
ALTER TABLE bk_reports ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE bk_reports ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_reports ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_reports', 'bk_reports_report_type_check', 'report_type IN (''progress'',''financial'',''assets'',''claims'',''trustee'',''final'',''court'')', 'report_type IS NOT NULL AND report_type NOT IN (''progress'',''financial'',''assets'',''claims'',''trustee'',''final'',''court'')', 'bk_reports report_type');
  PERFORM pg_temp.add_014_bk_fk('bk_reports', 'bk_reports_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_reports_case ON bk_reports(case_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11) bk_ai_analysis
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_ai_analysis (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL CONSTRAINT bk_ai_analysis_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  office_id     TEXT NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'general'
                  CONSTRAINT bk_ai_analysis_analysis_type_check
                  CHECK (analysis_type IN ('general','claims','assets','risk','financial','summary','trustee_report')),
  input_source  TEXT,
  result        TEXT,
  token_count   INT DEFAULT 0,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS analysis_type TEXT;
ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS input_source TEXT;
ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS result TEXT;
ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS token_count INT;
ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_ai_analysis ALTER COLUMN analysis_type SET DEFAULT 'general';
ALTER TABLE bk_ai_analysis ALTER COLUMN token_count SET DEFAULT 0;
ALTER TABLE bk_ai_analysis ALTER COLUMN generated_at SET DEFAULT NOW();
ALTER TABLE bk_ai_analysis ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_ai_analysis', 'bk_ai_analysis_analysis_type_check', 'analysis_type IN (''general'',''claims'',''assets'',''risk'',''financial'',''summary'',''trustee_report'')', 'analysis_type IS NOT NULL AND analysis_type NOT IN (''general'',''claims'',''assets'',''risk'',''financial'',''summary'',''trustee_report'')', 'bk_ai_analysis analysis_type');
  PERFORM pg_temp.add_014_bk_fk('bk_ai_analysis', 'bk_ai_analysis_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_ai_case ON bk_ai_analysis(case_id);
CREATE INDEX IF NOT EXISTS idx_bk_ai_office_date ON bk_ai_analysis(office_id, generated_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12) bk_timeline
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_timeline (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  case_id      TEXT,
  entity_type  VARCHAR(50),
  entity_id    TEXT,
  action_type  VARCHAR(100) NOT NULL,
  description  TEXT,
  performed_by TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_timeline ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_timeline ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE bk_timeline ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE bk_timeline ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE bk_timeline ADD COLUMN IF NOT EXISTS action_type VARCHAR(100);
ALTER TABLE bk_timeline ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bk_timeline ADD COLUMN IF NOT EXISTS performed_by TEXT;
ALTER TABLE bk_timeline ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE bk_timeline ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bk_timeline_case ON bk_timeline(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bk_timeline_office ON bk_timeline(office_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 13) bk_audit_logs
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  user_id      TEXT,
  action       VARCHAR(50) NOT NULL,
  entity_type  VARCHAR(50),
  entity_id    TEXT,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   VARCHAR(255),
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(50);
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS new_data JSONB;
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(255);
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE bk_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE bk_audit_logs ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bk_audit_office ON bk_audit_logs(office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bk_audit_entity ON bk_audit_logs(entity_type, entity_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 14) bk_notifications
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  user_id      TEXT,
  title        VARCHAR(255) NOT NULL,
  message      TEXT,
  type         VARCHAR(50) NOT NULL DEFAULT 'info',
  status       VARCHAR(20) NOT NULL DEFAULT 'unread',
  related_case TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at      TIMESTAMPTZ
);

ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS status VARCHAR(20);
ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS related_case TEXT;
ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE bk_notifications ALTER COLUMN type SET DEFAULT 'info';
ALTER TABLE bk_notifications ALTER COLUMN status SET DEFAULT 'unread';
ALTER TABLE bk_notifications ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bk_notif_office ON bk_notifications(office_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bk_notif_user ON bk_notifications(user_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 15) bk_workflows
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_workflows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  case_id      UUID NOT NULL CONSTRAINT bk_workflows_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  current_step INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active'
                 CONSTRAINT bk_workflows_status_check
                 CHECK (status IN ('active','completed','suspended','cancelled')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bk_workflows_case_id_key UNIQUE (case_id)
);

ALTER TABLE bk_workflows ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_workflows ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_workflows ADD COLUMN IF NOT EXISTS current_step INT;
ALTER TABLE bk_workflows ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_workflows ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE bk_workflows ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE bk_workflows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE bk_workflows ALTER COLUMN current_step SET DEFAULT 0;
ALTER TABLE bk_workflows ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE bk_workflows ALTER COLUMN started_at SET DEFAULT NOW();
ALTER TABLE bk_workflows ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_workflows', 'bk_workflows_status_check', 'status IN (''active'',''completed'',''suspended'',''cancelled'')', 'status IS NOT NULL AND status NOT IN (''active'',''completed'',''suspended'',''cancelled'')', 'bk_workflows status');
  PERFORM pg_temp.add_014_bk_unique('bk_workflows', 'bk_workflows_case_id_key', ARRAY['case_id'], 'bk_workflows');
  PERFORM pg_temp.add_014_bk_fk('bk_workflows', 'bk_workflows_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_workflows_case ON bk_workflows(case_id);
CREATE INDEX IF NOT EXISTS idx_bk_workflows_office ON bk_workflows(office_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 16) bk_workflow_steps
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_workflow_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   UUID NOT NULL CONSTRAINT bk_workflow_steps_workflow_id_fkey REFERENCES bk_workflows(id) ON DELETE CASCADE,
  office_id     TEXT NOT NULL,
  step_order    INT NOT NULL,
  step_key      TEXT NOT NULL,
  step_label    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CONSTRAINT bk_workflow_steps_status_check
                  CHECK (status IN ('pending','in_progress','completed','skipped','blocked')),
  assigned_to   TEXT,
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  required_docs TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS workflow_id UUID;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS step_order INT;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS step_key TEXT;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS step_label TEXT;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS required_docs TEXT[];
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_workflow_steps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE bk_workflow_steps ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE bk_workflow_steps ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_workflow_steps ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_workflow_steps', 'bk_workflow_steps_status_check', 'status IN (''pending'',''in_progress'',''completed'',''skipped'',''blocked'')', 'status IS NOT NULL AND status NOT IN (''pending'',''in_progress'',''completed'',''skipped'',''blocked'')', 'bk_workflow_steps status');
  PERFORM pg_temp.add_014_bk_fk('bk_workflow_steps', 'bk_workflow_steps_workflow_id_fkey', 'workflow_id', 'bk_workflows', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_wf_steps_wf ON bk_workflow_steps(workflow_id, step_order);

-- ═══════════════════════════════════════════════════════════════════════════
-- 17) bk_workflow_events
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_workflow_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id  UUID NOT NULL CONSTRAINT bk_workflow_events_workflow_id_fkey REFERENCES bk_workflows(id) ON DELETE CASCADE,
  office_id    TEXT NOT NULL,
  step_key     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  description  TEXT,
  performed_by TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_workflow_events ADD COLUMN IF NOT EXISTS workflow_id UUID;
ALTER TABLE bk_workflow_events ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_workflow_events ADD COLUMN IF NOT EXISTS step_key TEXT;
ALTER TABLE bk_workflow_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE bk_workflow_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bk_workflow_events ADD COLUMN IF NOT EXISTS performed_by TEXT;
ALTER TABLE bk_workflow_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE bk_workflow_events ALTER COLUMN created_at SET DEFAULT NOW();

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_fk('bk_workflow_events', 'bk_workflow_events_workflow_id_fkey', 'workflow_id', 'bk_workflows', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_wf_events_wf ON bk_workflow_events(workflow_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 18) bk_tasks
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  case_id      UUID CONSTRAINT bk_tasks_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  task_type    TEXT NOT NULL DEFAULT 'manual'
                 CONSTRAINT bk_tasks_task_type_check
                 CHECK (task_type IN ('manual','auto','ai_suggested')),
  priority     TEXT NOT NULL DEFAULT 'medium'
                 CONSTRAINT bk_tasks_priority_check
                 CHECK (priority IN ('low','medium','high','critical')),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CONSTRAINT bk_tasks_status_check
                 CHECK (status IN ('pending','in_progress','completed','cancelled','overdue')),
  assigned_to  TEXT,
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  escalated    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo      BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS task_type TEXT;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS escalated BOOLEAN;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE bk_tasks ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_tasks ALTER COLUMN task_type SET DEFAULT 'manual';
ALTER TABLE bk_tasks ALTER COLUMN priority SET DEFAULT 'medium';
ALTER TABLE bk_tasks ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE bk_tasks ALTER COLUMN escalated SET DEFAULT FALSE;
ALTER TABLE bk_tasks ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_tasks ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE bk_tasks ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_tasks', 'bk_tasks_task_type_check', 'task_type IN (''manual'',''auto'',''ai_suggested'')', 'task_type IS NOT NULL AND task_type NOT IN (''manual'',''auto'',''ai_suggested'')', 'bk_tasks task_type');
  PERFORM pg_temp.add_014_bk_check('bk_tasks', 'bk_tasks_priority_check', 'priority IN (''low'',''medium'',''high'',''critical'')', 'priority IS NOT NULL AND priority NOT IN (''low'',''medium'',''high'',''critical'')', 'bk_tasks priority');
  PERFORM pg_temp.add_014_bk_check('bk_tasks', 'bk_tasks_status_check', 'status IN (''pending'',''in_progress'',''completed'',''cancelled'',''overdue'')', 'status IS NOT NULL AND status NOT IN (''pending'',''in_progress'',''completed'',''cancelled'',''overdue'')', 'bk_tasks status');
  PERFORM pg_temp.add_014_bk_fk('bk_tasks', 'bk_tasks_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_tasks_case ON bk_tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_bk_tasks_office ON bk_tasks(office_id, status);
CREATE INDEX IF NOT EXISTS idx_bk_tasks_due ON bk_tasks(due_date) WHERE status NOT IN ('completed','cancelled');

-- ═══════════════════════════════════════════════════════════════════════════
-- 19) bk_task_comments
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL CONSTRAINT bk_task_comments_task_id_fkey REFERENCES bk_tasks(id) ON DELETE CASCADE,
  office_id  TEXT NOT NULL,
  user_id    TEXT,
  comment    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_task_comments ADD COLUMN IF NOT EXISTS task_id UUID;
ALTER TABLE bk_task_comments ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_task_comments ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE bk_task_comments ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE bk_task_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE bk_task_comments ALTER COLUMN created_at SET DEFAULT NOW();

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_fk('bk_task_comments', 'bk_task_comments_task_id_fkey', 'task_id', 'bk_tasks', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_task_comments ON bk_task_comments(task_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 20) bk_task_assignments
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_task_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL CONSTRAINT bk_task_assignments_task_id_fkey REFERENCES bk_tasks(id) ON DELETE CASCADE,
  office_id   TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_task_assignments ADD COLUMN IF NOT EXISTS task_id UUID;
ALTER TABLE bk_task_assignments ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_task_assignments ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE bk_task_assignments ADD COLUMN IF NOT EXISTS assigned_by TEXT;
ALTER TABLE bk_task_assignments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

ALTER TABLE bk_task_assignments ALTER COLUMN assigned_at SET DEFAULT NOW();

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_fk('bk_task_assignments', 'bk_task_assignments_task_id_fkey', 'task_id', 'bk_tasks', 'id', 'CASCADE');
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 21) bk_templates
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id     TEXT NOT NULL,
  template_type TEXT NOT NULL
                  CONSTRAINT bk_templates_template_type_check
                  CHECK (template_type IN ('opening_petition','trustee_report','meeting_minutes','distribution_report','claim_review','asset_evaluation','court_correspondence','executive_summary','creditors_register')),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  ai_generated  BOOLEAN NOT NULL DEFAULT FALSE,
  approved      BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  variables     JSONB DEFAULT '[]',
  usage_count   INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS template_type TEXT;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS approved BOOLEAN;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS variables JSONB;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS usage_count INT;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE bk_templates ALTER COLUMN ai_generated SET DEFAULT FALSE;
ALTER TABLE bk_templates ALTER COLUMN approved SET DEFAULT FALSE;
ALTER TABLE bk_templates ALTER COLUMN variables SET DEFAULT '[]';
ALTER TABLE bk_templates ALTER COLUMN usage_count SET DEFAULT 0;
ALTER TABLE bk_templates ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_templates ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_templates', 'bk_templates_template_type_check', 'template_type IN (''opening_petition'',''trustee_report'',''meeting_minutes'',''distribution_report'',''claim_review'',''asset_evaluation'',''court_correspondence'',''executive_summary'',''creditors_register'')', 'template_type IS NOT NULL AND template_type NOT IN (''opening_petition'',''trustee_report'',''meeting_minutes'',''distribution_report'',''claim_review'',''asset_evaluation'',''court_correspondence'',''executive_summary'',''creditors_register'')', 'bk_templates template_type');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_templates_office ON bk_templates(office_id, template_type);
CREATE INDEX IF NOT EXISTS idx_bk_templates_approved ON bk_templates(office_id, approved);

-- ═══════════════════════════════════════════════════════════════════════════
-- 22) bk_alerts
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       TEXT NOT NULL,
  case_id         UUID CONSTRAINT bk_alerts_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL
                    CONSTRAINT bk_alerts_alert_type_check
                    CHECK (alert_type IN ('high_risk_case','large_claim_dispute','missing_documents','asset_valuation_delay','distribution_delay','court_deadline','cash_flow_risk','ai_risk_detection','overdue_task')),
  severity        TEXT NOT NULL DEFAULT 'info'
                    CONSTRAINT bk_alerts_severity_check
                    CHECK (severity IN ('info','warning','high','critical')),
  title           TEXT NOT NULL,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CONSTRAINT bk_alerts_status_check
                    CHECK (status IN ('active','acknowledged','resolved','dismissed')),
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo         BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS alert_type TEXT;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS acknowledged_by TEXT;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_alerts ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_alerts ALTER COLUMN severity SET DEFAULT 'info';
ALTER TABLE bk_alerts ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE bk_alerts ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_alerts ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_alerts', 'bk_alerts_alert_type_check', 'alert_type IN (''high_risk_case'',''large_claim_dispute'',''missing_documents'',''asset_valuation_delay'',''distribution_delay'',''court_deadline'',''cash_flow_risk'',''ai_risk_detection'',''overdue_task'')', 'alert_type IS NOT NULL AND alert_type NOT IN (''high_risk_case'',''large_claim_dispute'',''missing_documents'',''asset_valuation_delay'',''distribution_delay'',''court_deadline'',''cash_flow_risk'',''ai_risk_detection'',''overdue_task'')', 'bk_alerts alert_type');
  PERFORM pg_temp.add_014_bk_check('bk_alerts', 'bk_alerts_severity_check', 'severity IN (''info'',''warning'',''high'',''critical'')', 'severity IS NOT NULL AND severity NOT IN (''info'',''warning'',''high'',''critical'')', 'bk_alerts severity');
  PERFORM pg_temp.add_014_bk_check('bk_alerts', 'bk_alerts_status_check', 'status IN (''active'',''acknowledged'',''resolved'',''dismissed'')', 'status IS NOT NULL AND status NOT IN (''active'',''acknowledged'',''resolved'',''dismissed'')', 'bk_alerts status');
  PERFORM pg_temp.add_014_bk_fk('bk_alerts', 'bk_alerts_case_id_fkey', 'case_id', 'bankruptcy_cases', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_alerts_office ON bk_alerts(office_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bk_alerts_case ON bk_alerts(case_id, severity);
CREATE INDEX IF NOT EXISTS idx_bk_alerts_active ON bk_alerts(office_id, severity) WHERE status='active';

-- ═══════════════════════════════════════════════════════════════════════════
-- 23) bk_opening_requests
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_opening_requests (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id                  TEXT NOT NULL,
  request_number             TEXT NOT NULL,
  company_name               TEXT NOT NULL,
  commercial_registration    TEXT,
  entity_type                TEXT,
  industry                   TEXT,
  employee_count             INT,
  annual_revenue             NUMERIC(18,2),
  total_assets               NUMERIC(18,2),
  total_liabilities          NUMERIC(18,2),
  available_cash             NUMERIC(18,2),
  due_debts                  NUMERIC(18,2),
  procedure_recommendation   TEXT,
  eligibility_score          INT,
  financial_distress_score   INT,
  liquidity_risk_score       INT,
  recovery_potential_score   INT,
  confidence_level           INT,
  ai_analysis                JSONB,
  readiness_score            INT,
  readiness_details          JSONB,
  court_package_content      TEXT,
  court_package_generated_at TIMESTAMPTZ,
  status                     TEXT NOT NULL DEFAULT 'draft'
                               CONSTRAINT bk_opening_requests_status_check
                               CHECK (status IN ('draft','under_assessment','documents_pending','ai_analysis','ready_for_filing','under_legal_review','approved_for_submission','submitted_to_court','converted_to_case','closed','cancelled')),
  converted_case_id          UUID CONSTRAINT bk_opening_requests_converted_case_id_fkey REFERENCES bankruptcy_cases(id) ON DELETE SET NULL,
  created_by                 TEXT,
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo                    BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS request_number TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS commercial_registration TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS employee_count INT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(18,2);
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS total_assets NUMERIC(18,2);
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS total_liabilities NUMERIC(18,2);
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS available_cash NUMERIC(18,2);
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS due_debts NUMERIC(18,2);
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS procedure_recommendation TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS eligibility_score INT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS financial_distress_score INT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS liquidity_risk_score INT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS recovery_potential_score INT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS confidence_level INT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS readiness_score INT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS readiness_details JSONB;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS court_package_content TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS court_package_generated_at TIMESTAMPTZ;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS converted_case_id UUID;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE bk_opening_requests ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_opening_requests ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE bk_opening_requests ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bk_opening_requests ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE bk_opening_requests ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_check('bk_opening_requests', 'bk_opening_requests_status_check', 'status IN (''draft'',''under_assessment'',''documents_pending'',''ai_analysis'',''ready_for_filing'',''under_legal_review'',''approved_for_submission'',''submitted_to_court'',''converted_to_case'',''closed'',''cancelled'')', 'status IS NOT NULL AND status NOT IN (''draft'',''under_assessment'',''documents_pending'',''ai_analysis'',''ready_for_filing'',''under_legal_review'',''approved_for_submission'',''submitted_to_court'',''converted_to_case'',''closed'',''cancelled'')', 'bk_opening_requests status');
  PERFORM pg_temp.add_014_bk_fk('bk_opening_requests', 'bk_opening_requests_converted_case_id_fkey', 'converted_case_id', 'bankruptcy_cases', 'id', 'SET NULL');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_or_office ON bk_opening_requests(office_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 24) bk_opening_request_documents
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_opening_request_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id     TEXT NOT NULL,
  request_id    UUID NOT NULL CONSTRAINT bk_opening_request_documents_request_id_fkey REFERENCES bk_opening_requests(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_url      TEXT,
  notes         TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bk_opening_request_documents ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_opening_request_documents ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE bk_opening_request_documents ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE bk_opening_request_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE bk_opening_request_documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE bk_opening_request_documents ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bk_opening_request_documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
ALTER TABLE bk_opening_request_documents ADD COLUMN IF NOT EXISTS is_demo BOOLEAN;

ALTER TABLE bk_opening_request_documents ALTER COLUMN uploaded_at SET DEFAULT NOW();
ALTER TABLE bk_opening_request_documents ALTER COLUMN is_demo SET DEFAULT FALSE;

DO $$ BEGIN
  PERFORM pg_temp.add_014_bk_fk('bk_opening_request_documents', 'bk_opening_request_documents_request_id_fkey', 'request_id', 'bk_opening_requests', 'id', 'CASCADE');
END $$;

CREATE INDEX IF NOT EXISTS idx_bk_or_docs_req ON bk_opening_request_documents(request_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 25) bk_emergency_locks
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bk_emergency_locks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   TEXT NOT NULL,
  lock_type   TEXT NOT NULL,
  target_id   TEXT,
  reason      TEXT,
  locked_by   TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS lock_type TEXT;
ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE bk_emergency_locks ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

ALTER TABLE bk_emergency_locks ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE bk_emergency_locks ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bk_emg_office ON bk_emergency_locks(office_id, is_active);

COMMIT;
