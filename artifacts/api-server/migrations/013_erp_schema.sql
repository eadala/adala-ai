-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 013: ERP schema (Schema Authority Batch — ERP)
--
-- Owns:
--   office_erp_ledger
--   financial_anomalies
--   chart_of_accounts
--   journal_entries
--   journal_items
--
-- Source of truth (former Runtime DDL):
--   ensureERPTables()      — artifacts/api-server/src/modules/financial/erp-ledger.ts
--   ensureJournalTables()  — artifacts/api-server/src/modules/financial/journalAccounting.ts
--     (CoA seed remains application data path after this migration)
--
-- Column types: ASSUMED for existing columns (ADD COLUMN IF NOT EXISTS does not
-- rewrite types). No automatic CAST/rewrite of production data.
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS (no NOT NULL force)
--   - UNIQUE / CHECK / FK skipped with WARNING if legacy data would fail
--   - column repairs still COMMIT when enforcement is skipped
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) office_erp_ledger
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS office_erp_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       TEXT NOT NULL,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type      TEXT NOT NULL
                    CHECK (entry_type IN ('DEBIT','CREDIT')),
  account_code    TEXT NOT NULL,
  account_name    TEXT NOT NULL,
  account_type    TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL
                    CONSTRAINT chk_amount_positive CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'SAR',
  reference_type  TEXT,
  reference_id    TEXT,
  pair_id         UUID,
  description     TEXT,
  posted_by       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS entry_date DATE;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS entry_type TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS pair_id UUID;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS posted_by TEXT;
ALTER TABLE office_erp_ledger ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE office_erp_ledger ALTER COLUMN entry_date SET DEFAULT CURRENT_DATE;
ALTER TABLE office_erp_ledger ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE office_erp_ledger ALTER COLUMN created_at SET DEFAULT NOW();

-- entry_type CHECK preflight
DO $$
DECLARE
  invalid_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.office_erp_ledger'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%entry_type%'
      AND pg_get_constraintdef(oid) ILIKE '%DEBIT%'
      AND pg_get_constraintdef(oid) ILIKE '%CREDIT%'
  ) THEN
    SELECT COUNT(*) INTO invalid_cnt
    FROM office_erp_ledger
    WHERE entry_type IS NOT NULL
      AND entry_type NOT IN ('DEBIT', 'CREDIT');

    IF invalid_cnt > 0 THEN
      RAISE WARNING
        '013_erp: skipping office_erp_ledger entry_type CHECK — % row(s) outside (DEBIT, CREDIT); cleanup required',
        invalid_cnt;
    ELSE
      ALTER TABLE office_erp_ledger
        ADD CONSTRAINT office_erp_ledger_entry_type_check
        CHECK (entry_type IN ('DEBIT','CREDIT'));
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN check_violation THEN
    RAISE WARNING '013_erp: skipping office_erp_ledger entry_type CHECK — check_violation on legacy data';
END $$;

-- amount > 0 CHECK preflight
DO $$
DECLARE
  invalid_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.office_erp_ledger'::regclass
      AND contype = 'c'
      AND (
        conname = 'chk_amount_positive'
        OR pg_get_constraintdef(oid) ILIKE '%amount%>(%0%)%'
        OR pg_get_constraintdef(oid) ILIKE '%(amount > 0)%'
      )
  ) THEN
    SELECT COUNT(*) INTO invalid_cnt
    FROM office_erp_ledger
    WHERE amount IS NOT NULL AND amount <= 0;

    IF invalid_cnt > 0 THEN
      RAISE WARNING
        '013_erp: skipping office_erp_ledger amount CHECK — % row(s) with amount <= 0; cleanup required',
        invalid_cnt;
    ELSE
      ALTER TABLE office_erp_ledger
        ADD CONSTRAINT chk_amount_positive CHECK (amount > 0);
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN check_violation THEN
    RAISE WARNING '013_erp: skipping office_erp_ledger amount CHECK — check_violation on legacy data';
END $$;

CREATE INDEX IF NOT EXISTS idx_erp_office ON office_erp_ledger(office_id);
CREATE INDEX IF NOT EXISTS idx_erp_pair ON office_erp_ledger(pair_id);
CREATE INDEX IF NOT EXISTS idx_erp_date ON office_erp_ledger(office_id, entry_date DESC);

ALTER TABLE office_erp_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'office_erp_ledger'
      AND policyname = 'zta_erp_ledger'
  ) THEN
    CREATE POLICY zta_erp_ledger ON office_erp_ledger
      USING (office_id = NULLIF(current_setting('app.current_tenant', true), ''));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) financial_anomalies
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS financial_anomalies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'medium',
  description  TEXT NOT NULL,
  amount       NUMERIC(14,2),
  reference    TEXT,
  resolved     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financial_anomalies ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE financial_anomalies ADD COLUMN IF NOT EXISTS anomaly_type TEXT;
ALTER TABLE financial_anomalies ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE financial_anomalies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE financial_anomalies ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);
ALTER TABLE financial_anomalies ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE financial_anomalies ADD COLUMN IF NOT EXISTS resolved BOOLEAN;
ALTER TABLE financial_anomalies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE financial_anomalies ALTER COLUMN severity SET DEFAULT 'medium';
ALTER TABLE financial_anomalies ALTER COLUMN resolved SET DEFAULT FALSE;
ALTER TABLE financial_anomalies ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_financial_anomalies_office
  ON financial_anomalies(office_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_anomalies_unresolved
  ON financial_anomalies(office_id)
  WHERE resolved = false OR resolved IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) chart_of_accounts
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id     TEXT NOT NULL,
  account_code  TEXT NOT NULL,
  account_name  TEXT NOT NULL,
  account_type  TEXT NOT NULL
                  CHECK (account_type IN ('Asset','Liability','Equity','Revenue','Expense')),
  parent_code   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, account_code)
);

ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS parent_code TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE chart_of_accounts ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE chart_of_accounts ALTER COLUMN created_at SET DEFAULT NOW();

-- account_type CHECK preflight
DO $$
DECLARE
  invalid_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.chart_of_accounts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%account_type%'
      AND pg_get_constraintdef(oid) ILIKE '%Asset%'
      AND pg_get_constraintdef(oid) ILIKE '%Liability%'
  ) THEN
    SELECT COUNT(*) INTO invalid_cnt
    FROM chart_of_accounts
    WHERE account_type IS NOT NULL
      AND account_type NOT IN ('Asset','Liability','Equity','Revenue','Expense');

    IF invalid_cnt > 0 THEN
      RAISE WARNING
        '013_erp: skipping chart_of_accounts account_type CHECK — % row(s) invalid; cleanup required',
        invalid_cnt;
    ELSE
      ALTER TABLE chart_of_accounts
        ADD CONSTRAINT chart_of_accounts_account_type_check
        CHECK (account_type IN ('Asset','Liability','Equity','Revenue','Expense'));
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN check_violation THEN
    RAISE WARNING '013_erp: skipping chart_of_accounts account_type CHECK — check_violation on legacy data';
END $$;

-- UNIQUE(office_id, account_code) preflight
DO $$
DECLARE
  dup_cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.chart_of_accounts'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%office_id%'
      AND pg_get_constraintdef(oid) ILIKE '%account_code%'
  ) OR EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'chart_of_accounts'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%office_id%'
      AND indexdef ILIKE '%account_code%'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_cnt
  FROM (
    SELECT office_id, account_code
    FROM chart_of_accounts
    WHERE office_id IS NOT NULL AND account_code IS NOT NULL
    GROUP BY office_id, account_code
    HAVING COUNT(*) > 1
  ) d;

  IF dup_cnt > 0 THEN
    RAISE WARNING
      '013_erp: skipping chart_of_accounts UNIQUE(office_id, account_code) — % duplicate pair(s); cleanup required',
      dup_cnt;
  ELSE
    ALTER TABLE chart_of_accounts
      ADD CONSTRAINT chart_of_accounts_office_id_account_code_key
      UNIQUE (office_id, account_code);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN unique_violation THEN
    RAISE WARNING '013_erp: skipping chart_of_accounts UNIQUE — unique_violation on legacy data';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) journal_entries
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS journal_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id        TEXT NOT NULL,
  entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  description      TEXT NOT NULL,
  reference_number TEXT,
  reference_type   TEXT,
  reference_id     TEXT,
  posted_by        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_date DATE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE journal_entries ALTER COLUMN entry_date SET DEFAULT CURRENT_DATE;
ALTER TABLE journal_entries ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_je_office ON journal_entries(office_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) journal_items
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS journal_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     UUID NOT NULL,
  office_id    TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  debit        NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit       NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes        TEXT
);

ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS entry_id UUID;
ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS debit NUMERIC(15,2);
ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS credit NUMERIC(15,2);
ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE journal_items ALTER COLUMN debit SET DEFAULT 0;
ALTER TABLE journal_items ALTER COLUMN credit SET DEFAULT 0;

-- FK entry_id → journal_entries(id) ON DELETE CASCADE
-- Preflight: type compatibility + orphans; skip with WARNING (never abort migration)
DO $$
DECLARE
  orphan_cnt BIGINT;
  child_udt  TEXT;
  parent_udt TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.journal_items'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%entry_id%'
      AND pg_get_constraintdef(oid) ILIKE '%journal_entries%'
  ) THEN
    RETURN;
  END IF;

  SELECT c.udt_name INTO child_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'journal_items' AND c.column_name = 'entry_id';

  SELECT c.udt_name INTO parent_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'journal_entries' AND c.column_name = 'id';

  IF child_udt IS NULL OR parent_udt IS NULL THEN
    RAISE WARNING
      '013_erp: skipping journal_items FK — missing entry_id or journal_entries.id column';
    RETURN;
  END IF;

  IF child_udt IS DISTINCT FROM parent_udt THEN
    RAISE WARNING
      '013_erp: skipping journal_items FK — incompatible types journal_items.entry_id (%) vs journal_entries.id (%); cleanup required (no automatic cast)',
      child_udt, parent_udt;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO orphan_cnt
  FROM journal_items ji
  WHERE ji.entry_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM journal_entries je WHERE je.id = ji.entry_id
    );

  IF orphan_cnt > 0 THEN
    RAISE WARNING
      '013_erp: skipping journal_items FK to journal_entries — % orphan row(s); cleanup required',
      orphan_cnt;
  ELSE
    ALTER TABLE journal_items
      ADD CONSTRAINT journal_items_entry_id_fkey
      FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN foreign_key_violation THEN
    RAISE WARNING '013_erp: skipping journal_items FK — foreign_key_violation on legacy data';
  WHEN datatype_mismatch THEN
    RAISE WARNING '013_erp: skipping journal_items FK — datatype_mismatch between entry_id and journal_entries.id';
END $$;

CREATE INDEX IF NOT EXISTS idx_ji_entry ON journal_items(entry_id);
CREATE INDEX IF NOT EXISTS idx_ji_office ON journal_items(office_id);

COMMIT;
