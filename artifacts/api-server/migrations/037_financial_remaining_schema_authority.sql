-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 037: Remaining Financial Runtime DDL schema authority (Stage 5B)
--
-- Owns ONLY the still-executable Financial Runtime DDL confirmed by Stage 5A:
--   A) financialCore.ts — financial_accounts, ledger_entries (+ DML office_id),
--      wallets, lawyer_payouts (+ Runtime UNIQUE/defaults). Platform wallet seed
--      stays application DML (not schema authority).
--   B) invoices.ts — client_invoices extensions (client_name, tax_enabled,
--      amount_paid, view_token); invoice_payments + idx_inv_payments_*.
--   C) financial-completions.ts — office_tax_settings, invoice_revisions,
--      credit_notes, invoice_seq; client_invoices extensions (zatca_uuid,
--      qr_code_data, locked_at, linked_credit_note_id). Does NOT own
--      invoice_number (Migration 003).
--   D) accounting.ts — revenues.deleted_at, expenses.deleted_at
--   E) legal-core/cases.ts — idx_invoices_case_office, idx_revenues_case_office,
--      idx_expenses_case_office
--
-- Does NOT re-own: office_ledger (010/019), Stripe (011), payment_transactions
-- (012/019), ERP/journal (013), billing (025), gateway (032), baseline
-- client_invoices/revenues/expenses (003).
--
-- Idempotent. No DROP TABLE. No invented UNIQUE/FK beyond Runtime contracts.
-- Fail-closed. Post-apply readiness must pass before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── A1) financial_accounts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       TEXT NOT NULL,
  owner_type     TEXT NOT NULL DEFAULT 'office',
  label          TEXT,
  currency       TEXT NOT NULL DEFAULT 'SAR',
  balance        NUMERIC(14,2) NOT NULL DEFAULT 0,
  frozen_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE (owner_id, currency)
);

ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS owner_type TEXT;
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC(14,2);
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS frozen_balance NUMERIC(14,2);
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- ── A2) ledger_entries (Runtime CREATE; office_id is DML-required extension) ─
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_ref TEXT,
  debit_account   TEXT NOT NULL,
  credit_account  TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'SAR',
  description     TEXT,
  entry_type      TEXT DEFAULT 'payment',
  created_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS transaction_ref TEXT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS debit_account TEXT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS credit_account TEXT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS entry_type TEXT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
-- Narrow DML compatibility: Runtime CREATE omitted office_id but INSERT/SELECT use it.
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS office_id TEXT;

-- ── A3) wallets ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          TEXT NOT NULL UNIQUE,
  owner_label       TEXT,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending_balance   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_earned      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_withdrawn   NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'SAR',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS owner_label TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS available_balance NUMERIC(14,2);
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS pending_balance NUMERIC(14,2);
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_earned NUMERIC(14,2);
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(14,2);
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- ── A4) lawyer_payouts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lawyer_payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       TEXT NOT NULL,
  owner_label     TEXT,
  amount          NUMERIC(14,2) NOT NULL,
  platform_fee    NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(14,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  bank_reference  TEXT,
  provider        TEXT DEFAULT 'manual',
  transaction_ids TEXT[],
  notes           TEXT,
  processed_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS owner_label TEXT;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(14,2);
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS net_amount NUMERIC(14,2);
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS bank_reference TEXT;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS transaction_ids TEXT[];
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE lawyer_payouts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- ── B) client_invoices extensions (003 owns base table; 037 owns these cols) ─
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT true;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2);
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS view_token UUID DEFAULT gen_random_uuid();

-- ── B) invoice_payments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL,
  office_id   TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method      TEXT NOT NULL DEFAULT 'bank',
  notes       TEXT,
  recorded_by TEXT,
  paid_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS invoice_id UUID;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

-- ── C) office_tax_settings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_tax_settings (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id     TEXT NOT NULL UNIQUE,
  tax_enabled   BOOLEAN NOT NULL DEFAULT true,
  tax_rate      NUMERIC(5,2) NOT NULL DEFAULT 15,
  tax_type      TEXT NOT NULL DEFAULT 'VAT',
  tax_number    TEXT,
  tax_exempt    BOOLEAN NOT NULL DEFAULT false,
  zatca_enabled BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN;
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS tax_type TEXT;
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS tax_number TEXT;
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN;
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS zatca_enabled BOOLEAN;
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE office_tax_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── C) invoice_revisions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_revisions (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id   TEXT NOT NULL,
  office_id    TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  changed_by   TEXT NOT NULL,
  change_type  TEXT NOT NULL DEFAULT 'edit',
  snapshot     JSONB NOT NULL,
  old_snapshot JSONB,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS version INTEGER;
ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS changed_by TEXT;
ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS change_type TEXT;
ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS snapshot JSONB;
ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS old_snapshot JSONB;
ALTER TABLE invoice_revisions ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ;

-- ── C) credit_notes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id           TEXT NOT NULL,
  original_invoice_id TEXT NOT NULL,
  credit_number       TEXT NOT NULL,
  client_id           TEXT,
  client_name         TEXT,
  case_id             TEXT,
  amount              NUMERIC(12,2) NOT NULL,
  tax_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL,
  reason              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'issued',
  notes               TEXT,
  issued_by           TEXT,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS original_invoice_id TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS credit_number TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS total NUMERIC(12,2);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS issued_by TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;

-- ── C) client_invoices ZATCA/lock extensions (NOT invoice_number — 003) ────
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS zatca_uuid TEXT;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS qr_code_data TEXT;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS linked_credit_note_id TEXT;

CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- ── D) soft-delete extensions on 003-owned revenues/expenses ───────────────
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation, NULL blocks, UUID tenant checks (where office_id is tenant)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
  non_uuid_cnt BIGINT;
  uuid_re CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  tbl TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('financial_accounts','id','uuid'),
      ('financial_accounts','owner_id','text'),
      ('financial_accounts','owner_type','text'),
      ('financial_accounts','label','text'),
      ('financial_accounts','currency','text'),
      ('financial_accounts','balance','numeric'),
      ('financial_accounts','frozen_balance','numeric'),
      ('financial_accounts','created_at','timestamp'),
      ('financial_accounts','updated_at','timestamp'),
      ('ledger_entries','id','uuid'),
      ('ledger_entries','transaction_ref','text'),
      ('ledger_entries','debit_account','text'),
      ('ledger_entries','credit_account','text'),
      ('ledger_entries','amount','numeric'),
      ('ledger_entries','currency','text'),
      ('ledger_entries','description','text'),
      ('ledger_entries','entry_type','text'),
      ('ledger_entries','created_at','timestamp'),
      ('ledger_entries','office_id','text'),
      ('wallets','id','uuid'),
      ('wallets','owner_id','text'),
      ('wallets','owner_label','text'),
      ('wallets','available_balance','numeric'),
      ('wallets','pending_balance','numeric'),
      ('wallets','total_earned','numeric'),
      ('wallets','total_withdrawn','numeric'),
      ('wallets','currency','text'),
      ('wallets','created_at','timestamp'),
      ('wallets','updated_at','timestamp'),
      ('lawyer_payouts','id','uuid'),
      ('lawyer_payouts','office_id','text'),
      ('lawyer_payouts','owner_label','text'),
      ('lawyer_payouts','amount','numeric'),
      ('lawyer_payouts','platform_fee','numeric'),
      ('lawyer_payouts','net_amount','numeric'),
      ('lawyer_payouts','status','text'),
      ('lawyer_payouts','bank_reference','text'),
      ('lawyer_payouts','provider','text'),
      ('lawyer_payouts','transaction_ids','_text'),
      ('lawyer_payouts','notes','text'),
      ('lawyer_payouts','processed_at','timestamp'),
      ('lawyer_payouts','created_at','timestamp'),
      ('lawyer_payouts','updated_at','timestamp'),
      ('invoice_payments','id','uuid'),
      ('invoice_payments','invoice_id','uuid'),
      ('invoice_payments','office_id','text'),
      ('invoice_payments','amount','numeric'),
      ('invoice_payments','method','text'),
      ('invoice_payments','notes','text'),
      ('invoice_payments','recorded_by','text'),
      ('invoice_payments','paid_at','timestamp'),
      ('invoice_payments','created_at','timestamp'),
      ('office_tax_settings','id','text'),
      ('office_tax_settings','office_id','text'),
      ('office_tax_settings','tax_enabled','bool'),
      ('office_tax_settings','tax_rate','numeric'),
      ('office_tax_settings','tax_type','text'),
      ('office_tax_settings','tax_number','text'),
      ('office_tax_settings','tax_exempt','bool'),
      ('office_tax_settings','zatca_enabled','bool'),
      ('office_tax_settings','notes','text'),
      ('office_tax_settings','updated_at','timestamptz'),
      ('invoice_revisions','id','text'),
      ('invoice_revisions','invoice_id','text'),
      ('invoice_revisions','office_id','text'),
      ('invoice_revisions','version','int4'),
      ('invoice_revisions','changed_by','text'),
      ('invoice_revisions','change_type','text'),
      ('invoice_revisions','snapshot','jsonb'),
      ('invoice_revisions','old_snapshot','jsonb'),
      ('invoice_revisions','changed_at','timestamptz'),
      ('credit_notes','id','text'),
      ('credit_notes','office_id','text'),
      ('credit_notes','original_invoice_id','text'),
      ('credit_notes','credit_number','text'),
      ('credit_notes','client_id','text'),
      ('credit_notes','client_name','text'),
      ('credit_notes','case_id','text'),
      ('credit_notes','amount','numeric'),
      ('credit_notes','tax_amount','numeric'),
      ('credit_notes','total','numeric'),
      ('credit_notes','reason','text'),
      ('credit_notes','status','text'),
      ('credit_notes','notes','text'),
      ('credit_notes','issued_by','text'),
      ('credit_notes','issued_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  -- Extension columns on 003-owned tables (037 owns these columns only)
  FOR spec IN
    SELECT * FROM (VALUES
      ('client_invoices','client_name','text'),
      ('client_invoices','tax_enabled','bool'),
      ('client_invoices','amount_paid','numeric'),
      ('client_invoices','view_token','uuid'),
      ('client_invoices','zatca_uuid','text'),
      ('client_invoices','qr_code_data','text'),
      ('client_invoices','locked_at','timestamptz'),
      ('client_invoices','linked_credit_note_id','text'),
      ('revenues','deleted_at','timestamptz'),
      ('expenses','deleted_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    IF to_regclass(format('public.%I', spec.table_name)) IS NULL THEN
      RAISE EXCEPTION
        '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — % missing (owned by Migration 003; 037 cannot invent it)',
        spec.table_name;
    END IF;
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY ARRAY[
    'lawyer_payouts','invoice_payments','office_tax_settings',
    'invoice_revisions','credit_notes'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE office_id IS NULL', tbl) INTO null_cnt;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION
        '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_OFFICE_ID) — % row(s) with NULL office_id on %',
        null_cnt, tbl;
    END IF;
    EXECUTE format(
      $q$SELECT COUNT(*) FROM %I WHERE office_id IS NOT NULL AND office_id !~ %L$q$,
      tbl, uuid_re
    ) INTO non_uuid_cnt;
    IF non_uuid_cnt > 0 THEN
      RAISE EXCEPTION
        '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NON_UUID_OFFICE_ID) — % non-UUID office_id row(s) on %',
        non_uuid_cnt, tbl;
    END IF;
  END LOOP;

  -- ledger_entries.office_id: when present must be UUID (nullable for legacy orphans)
  SELECT COUNT(*) INTO non_uuid_cnt FROM ledger_entries
  WHERE office_id IS NOT NULL AND office_id !~ uuid_re;
  IF non_uuid_cnt > 0 THEN
    RAISE EXCEPTION
      '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NON_UUID_OFFICE_ID) — % non-UUID office_id row(s) on ledger_entries',
      non_uuid_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM financial_accounts
  WHERE id IS NULL OR owner_id IS NULL OR owner_type IS NULL
    OR currency IS NULL OR balance IS NULL OR frozen_balance IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — financial_accounts has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM ledger_entries
  WHERE id IS NULL OR debit_account IS NULL OR credit_account IS NULL OR amount IS NULL OR currency IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — ledger_entries has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM wallets
  WHERE id IS NULL OR owner_id IS NULL OR available_balance IS NULL
    OR pending_balance IS NULL OR total_earned IS NULL OR total_withdrawn IS NULL OR currency IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — wallets has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM lawyer_payouts
  WHERE id IS NULL OR office_id IS NULL OR amount IS NULL OR platform_fee IS NULL
    OR net_amount IS NULL OR status IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — lawyer_payouts has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM invoice_payments
  WHERE id IS NULL OR invoice_id IS NULL OR office_id IS NULL OR amount IS NULL
    OR method IS NULL OR paid_at IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — invoice_payments has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM invoice_payments WHERE amount IS NOT NULL AND amount <= 0;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=CHECK_VIOLATION) — invoice_payments has % row(s) with amount <= 0', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM office_tax_settings
  WHERE id IS NULL OR office_id IS NULL OR tax_enabled IS NULL OR tax_rate IS NULL
    OR tax_type IS NULL OR tax_exempt IS NULL OR zatca_enabled IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — office_tax_settings has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM invoice_revisions
  WHERE id IS NULL OR invoice_id IS NULL OR office_id IS NULL OR version IS NULL
    OR changed_by IS NULL OR change_type IS NULL OR snapshot IS NULL OR changed_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — invoice_revisions has % NULL required row(s)', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM credit_notes
  WHERE id IS NULL OR office_id IS NULL OR original_invoice_id IS NULL
    OR credit_number IS NULL OR amount IS NULL OR tax_amount IS NULL OR total IS NULL
    OR reason IS NULL OR status IS NULL OR issued_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — credit_notes has % NULL required row(s)', null_cnt;
  END IF;

  -- amount_paid: safe backfill of Runtime DEFAULT 0 before SET NOT NULL
  UPDATE client_invoices SET amount_paid = 0 WHERE amount_paid IS NULL;
  SELECT COUNT(*) INTO null_cnt FROM client_invoices WHERE amount_paid IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — client_invoices.amount_paid still NULL after default fill';
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE financial_accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE financial_accounts ALTER COLUMN owner_type SET DEFAULT 'office';
ALTER TABLE financial_accounts ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE financial_accounts ALTER COLUMN balance SET DEFAULT 0;
ALTER TABLE financial_accounts ALTER COLUMN frozen_balance SET DEFAULT 0;
ALTER TABLE financial_accounts ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE financial_accounts ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE ledger_entries ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE ledger_entries ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE ledger_entries ALTER COLUMN entry_type SET DEFAULT 'payment';
ALTER TABLE ledger_entries ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE wallets ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE wallets ALTER COLUMN available_balance SET DEFAULT 0;
ALTER TABLE wallets ALTER COLUMN pending_balance SET DEFAULT 0;
ALTER TABLE wallets ALTER COLUMN total_earned SET DEFAULT 0;
ALTER TABLE wallets ALTER COLUMN total_withdrawn SET DEFAULT 0;
ALTER TABLE wallets ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE wallets ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE wallets ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE lawyer_payouts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE lawyer_payouts ALTER COLUMN platform_fee SET DEFAULT 0;
ALTER TABLE lawyer_payouts ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE lawyer_payouts ALTER COLUMN provider SET DEFAULT 'manual';
ALTER TABLE lawyer_payouts ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE lawyer_payouts ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE invoice_payments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE invoice_payments ALTER COLUMN method SET DEFAULT 'bank';
ALTER TABLE invoice_payments ALTER COLUMN paid_at SET DEFAULT NOW();
ALTER TABLE invoice_payments ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE client_invoices ALTER COLUMN tax_enabled SET DEFAULT true;
ALTER TABLE client_invoices ALTER COLUMN amount_paid SET DEFAULT 0;
ALTER TABLE client_invoices ALTER COLUMN view_token SET DEFAULT gen_random_uuid();

ALTER TABLE office_tax_settings ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE office_tax_settings ALTER COLUMN tax_enabled SET DEFAULT true;
ALTER TABLE office_tax_settings ALTER COLUMN tax_rate SET DEFAULT 15;
ALTER TABLE office_tax_settings ALTER COLUMN tax_type SET DEFAULT 'VAT';
ALTER TABLE office_tax_settings ALTER COLUMN tax_exempt SET DEFAULT false;
ALTER TABLE office_tax_settings ALTER COLUMN zatca_enabled SET DEFAULT false;
ALTER TABLE office_tax_settings ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE invoice_revisions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE invoice_revisions ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE invoice_revisions ALTER COLUMN change_type SET DEFAULT 'edit';
ALTER TABLE invoice_revisions ALTER COLUMN changed_at SET DEFAULT NOW();

ALTER TABLE credit_notes ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE credit_notes ALTER COLUMN tax_amount SET DEFAULT 0;
ALTER TABLE credit_notes ALTER COLUMN status SET DEFAULT 'issued';
ALTER TABLE credit_notes ALTER COLUMN issued_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes
DO $$
BEGIN
  ALTER TABLE financial_accounts ALTER COLUMN id SET NOT NULL;
  ALTER TABLE financial_accounts ALTER COLUMN owner_id SET NOT NULL;
  ALTER TABLE financial_accounts ALTER COLUMN owner_type SET NOT NULL;
  ALTER TABLE financial_accounts ALTER COLUMN currency SET NOT NULL;
  ALTER TABLE financial_accounts ALTER COLUMN balance SET NOT NULL;
  ALTER TABLE financial_accounts ALTER COLUMN frozen_balance SET NOT NULL;

  ALTER TABLE ledger_entries ALTER COLUMN id SET NOT NULL;
  ALTER TABLE ledger_entries ALTER COLUMN debit_account SET NOT NULL;
  ALTER TABLE ledger_entries ALTER COLUMN credit_account SET NOT NULL;
  ALTER TABLE ledger_entries ALTER COLUMN amount SET NOT NULL;
  ALTER TABLE ledger_entries ALTER COLUMN currency SET NOT NULL;

  ALTER TABLE wallets ALTER COLUMN id SET NOT NULL;
  ALTER TABLE wallets ALTER COLUMN owner_id SET NOT NULL;
  ALTER TABLE wallets ALTER COLUMN available_balance SET NOT NULL;
  ALTER TABLE wallets ALTER COLUMN pending_balance SET NOT NULL;
  ALTER TABLE wallets ALTER COLUMN total_earned SET NOT NULL;
  ALTER TABLE wallets ALTER COLUMN total_withdrawn SET NOT NULL;
  ALTER TABLE wallets ALTER COLUMN currency SET NOT NULL;

  ALTER TABLE lawyer_payouts ALTER COLUMN id SET NOT NULL;
  ALTER TABLE lawyer_payouts ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE lawyer_payouts ALTER COLUMN amount SET NOT NULL;
  ALTER TABLE lawyer_payouts ALTER COLUMN platform_fee SET NOT NULL;
  ALTER TABLE lawyer_payouts ALTER COLUMN net_amount SET NOT NULL;
  ALTER TABLE lawyer_payouts ALTER COLUMN status SET NOT NULL;

  ALTER TABLE invoice_payments ALTER COLUMN id SET NOT NULL;
  ALTER TABLE invoice_payments ALTER COLUMN invoice_id SET NOT NULL;
  ALTER TABLE invoice_payments ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE invoice_payments ALTER COLUMN amount SET NOT NULL;
  ALTER TABLE invoice_payments ALTER COLUMN method SET NOT NULL;
  ALTER TABLE invoice_payments ALTER COLUMN paid_at SET NOT NULL;
  ALTER TABLE invoice_payments ALTER COLUMN created_at SET NOT NULL;

  ALTER TABLE client_invoices ALTER COLUMN amount_paid SET NOT NULL;

  ALTER TABLE office_tax_settings ALTER COLUMN id SET NOT NULL;
  ALTER TABLE office_tax_settings ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE office_tax_settings ALTER COLUMN tax_enabled SET NOT NULL;
  ALTER TABLE office_tax_settings ALTER COLUMN tax_rate SET NOT NULL;
  ALTER TABLE office_tax_settings ALTER COLUMN tax_type SET NOT NULL;
  ALTER TABLE office_tax_settings ALTER COLUMN tax_exempt SET NOT NULL;
  ALTER TABLE office_tax_settings ALTER COLUMN zatca_enabled SET NOT NULL;
  ALTER TABLE office_tax_settings ALTER COLUMN updated_at SET NOT NULL;

  ALTER TABLE invoice_revisions ALTER COLUMN id SET NOT NULL;
  ALTER TABLE invoice_revisions ALTER COLUMN invoice_id SET NOT NULL;
  ALTER TABLE invoice_revisions ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE invoice_revisions ALTER COLUMN version SET NOT NULL;
  ALTER TABLE invoice_revisions ALTER COLUMN changed_by SET NOT NULL;
  ALTER TABLE invoice_revisions ALTER COLUMN change_type SET NOT NULL;
  ALTER TABLE invoice_revisions ALTER COLUMN snapshot SET NOT NULL;
  ALTER TABLE invoice_revisions ALTER COLUMN changed_at SET NOT NULL;

  ALTER TABLE credit_notes ALTER COLUMN id SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN original_invoice_id SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN credit_number SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN amount SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN tax_amount SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN total SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN reason SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN status SET NOT NULL;
  ALTER TABLE credit_notes ALTER COLUMN issued_at SET NOT NULL;
END $$;

-- PK (id) for owned tables
DO $$
DECLARE
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'financial_accounts','ledger_entries','wallets','lawyer_payouts',
    'invoice_payments','office_tax_settings','invoice_revisions','credit_notes'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format('SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d', tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

-- Runtime UNIQUE arbiters (financial_accounts, wallets, office_tax_settings)
DO $$
DECLARE
  dup_cnt BIGINT;
  has_uq BOOLEAN;
  uq_def TEXT;
BEGIN
  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT owner_id, currency FROM financial_accounts GROUP BY owner_id, currency HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate (owner_id,currency) group(s) on financial_accounts', dup_cnt;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.financial_accounts'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*owner_id\s*,\s*currency\s*\)'
  ) INTO has_uq;
  IF NOT has_uq THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = 'public' AND x.indrelid = 'public.financial_accounts'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['owner_id','currency']::text[]
    ) INTO has_uq;
  END IF;
  IF NOT has_uq THEN
    ALTER TABLE financial_accounts ADD CONSTRAINT financial_accounts_owner_id_currency_key UNIQUE (owner_id, currency);
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT owner_id FROM wallets GROUP BY owner_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate owner_id group(s) on wallets', dup_cnt;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.wallets'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*owner_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) INTO has_uq;
  IF NOT has_uq THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = 'public' AND x.indrelid = 'public.wallets'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['owner_id']::text[]
    ) INTO has_uq;
  END IF;
  IF NOT has_uq THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_owner_id_key UNIQUE (owner_id);
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id FROM office_tax_settings GROUP BY office_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % duplicate office_id group(s) on office_tax_settings', dup_cnt;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.office_tax_settings'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) INTO has_uq;
  IF NOT has_uq THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = 'public' AND x.indrelid = 'public.office_tax_settings'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['office_id']::text[]
    ) INTO has_uq;
  END IF;
  IF NOT has_uq THEN
    ALTER TABLE office_tax_settings ADD CONSTRAINT office_tax_settings_office_id_key UNIQUE (office_id);
  END IF;

  -- invoice_payments CHECK (amount > 0)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.invoice_payments'::regclass AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ~* 'amount\s*>\s*0'
  ) THEN
    ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_amount_check CHECK (amount > 0);
  END IF;
END $$;

-- Indexes (named; block incompatible same-name)
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
    SELECT * FROM (VALUES
      ('idx_inv_payments_invoice','invoice_payments',ARRAY['invoice_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_inv_payments_invoice ON invoice_payments(invoice_id)'),
      ('idx_inv_payments_office','invoice_payments',ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_inv_payments_office ON invoice_payments(office_id)'),
      ('idx_invoice_revisions_invoice','invoice_revisions',ARRAY['invoice_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_invoice_revisions_invoice ON invoice_revisions(invoice_id)'),
      ('idx_credit_notes_office','credit_notes',ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_credit_notes_office ON credit_notes(office_id)'),
      ('idx_invoices_case_office','client_invoices',ARRAY['case_id','office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_invoices_case_office ON client_invoices (case_id, office_id)'),
      ('idx_revenues_case_office','revenues',ARRAY['case_id','office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_revenues_case_office ON revenues (case_id, office_id)'),
      ('idx_expenses_case_office','expenses',ARRAY['case_id','office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_expenses_case_office ON expenses (case_id, office_id)')
    ) AS t(index_name, table_name, columns, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    IF expected_table_oid IS NULL THEN
      RAISE EXCEPTION
        '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — index % needs table %',
        spec.index_name, spec.table_name;
    END IF;

    SELECT x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
    INTO actual_table_oid, index_unique, index_partial, index_expression,
      index_valid, index_ready, index_columns
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=spec.index_name;

    IF NOT FOUND THEN
      EXECUTE spec.create_sql;
    ELSE
      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS TRUE OR index_partial IS TRUE OR index_expression IS TRUE
         OR index_valid IS NOT TRUE OR index_ready IS NOT TRUE
         OR index_columns IS DISTINCT FROM spec.columns THEN
        RAISE EXCEPTION
          '037_financial: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (table=% cols=% expected=%)',
          spec.index_name, actual_table_oid, index_columns, spec.columns;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Post-apply readiness
DO $$
DECLARE
  tbl TEXT;
  idx_name TEXT;
  has_seq BOOLEAN;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'financial_accounts','ledger_entries','wallets','lawyer_payouts',
    'invoice_payments','office_tax_settings','invoice_revisions','credit_notes'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — missing table %', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=format('public.%I',tbl)::regclass AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — % PK (id) missing or incompatible', tbl;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY ARRAY['client_invoices','revenues','expenses']
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — base table % missing (003)', tbl;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='client_invoices' AND column_name='amount_paid'
      AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — client_invoices.amount_paid NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ledger_entries' AND column_name='office_id'
  ) THEN
    RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — ledger_entries.office_id missing (DML contract)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='invoice_seq' AND c.relkind='S'
  ) INTO has_seq;
  IF NOT has_seq THEN
    RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — invoice_seq missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.financial_accounts'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'owner_id'
      AND pg_get_constraintdef(c.oid) ~* 'currency'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    JOIN pg_class i ON i.oid=x.indexrelid
    JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND x.indrelid='public.financial_accounts'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['owner_id','currency']::text[]
  ) THEN
    RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — financial_accounts UNIQUE(owner_id,currency) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.wallets'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*owner_id\s*\)'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    JOIN pg_class i ON i.oid=x.indexrelid
    JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND x.indrelid='public.wallets'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['owner_id']::text[]
  ) THEN
    RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — wallets UNIQUE(owner_id) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.office_tax_settings'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index x
    JOIN pg_class i ON i.oid=x.indexrelid
    JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND x.indrelid='public.office_tax_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id']::text[]
  ) THEN
    RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — office_tax_settings UNIQUE(office_id) missing';
  END IF;

  FOREACH idx_name IN ARRAY ARRAY[
    'idx_inv_payments_invoice','idx_inv_payments_office',
    'idx_invoice_revisions_invoice','idx_credit_notes_office',
    'idx_invoices_case_office','idx_revenues_case_office','idx_expenses_case_office'
  ]
  LOOP
    IF to_regclass(format('public.%I', idx_name)) IS NULL THEN
      RAISE EXCEPTION '037_financial: POST_APPLY_READINESS_FAILED — required index % missing', idx_name;
    END IF;
  END LOOP;

  RAISE NOTICE '037_financial: post-apply FULL READY (8 tables; extensions on 003; invoice_seq; Runtime UNIQUEs; 7 indexes)';
END $$;

COMMIT;
