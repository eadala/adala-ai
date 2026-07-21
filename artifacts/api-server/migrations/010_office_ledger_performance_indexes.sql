-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 010: office_ledger + performance indexes (Schema Authority Batch 2)
--
-- Source of truth for office_ledger columns (proven from repo usage):
--   INSERT: webhookHandlers.recordRevenue / charge.refunded,
--           tenantProvisioning, financial.engine
--   SELECT: billing.ts, admin.ts, goLiveMetrics, stripeReconcile, monitoring
--   Docs:   STRIPE_PRODUCTION_AUDIT.md verified production columns + CHECK
--
-- Also moves CREATE INDEX statements previously run at API boot by
-- ensurePerformanceIndexes() in artifacts/api-server/src/index.ts.
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008 → 009
-- Idempotent: safe on fresh DBs and on DBs where table/indexes already exist.
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── office_ledger ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id        TEXT NOT NULL,
  type             TEXT NOT NULL
                     CHECK (type = ANY (ARRAY['credit'::text, 'debit'::text, 'refund'::text])),
  amount           NUMERIC NOT NULL,
  currency         TEXT DEFAULT 'SAR',
  ref              TEXT,
  description      TEXT,
  stripe_id        TEXT,
  stripe_event_id  TEXT,
  platform_fee     NUMERIC DEFAULT 0,
  stripe_fee       NUMERIC DEFAULT 0,
  net_amount       NUMERIC DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column adds for older/partial production tables
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS ref TEXT;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS stripe_id TEXT;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS platform_fee NUMERIC;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS stripe_fee NUMERIC;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS net_amount NUMERIC;
ALTER TABLE office_ledger ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Defaults for fee columns (match production / billing expectations)
ALTER TABLE office_ledger ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE office_ledger ALTER COLUMN platform_fee SET DEFAULT 0;
ALTER TABLE office_ledger ALTER COLUMN stripe_fee SET DEFAULT 0;
ALTER TABLE office_ledger ALTER COLUMN net_amount SET DEFAULT 0;
ALTER TABLE office_ledger ALTER COLUMN created_at SET DEFAULT NOW();

-- Ensure type CHECK exists (name may vary on older DBs — add only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.office_ledger'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%credit%debit%refund%'
  ) THEN
    ALTER TABLE office_ledger
      ADD CONSTRAINT office_ledger_type_check
      CHECK (type = ANY (ARRAY['credit'::text, 'debit'::text, 'refund'::text]));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- office_id lookup index (present on production; not previously in ensurePerformanceIndexes)
CREATE INDEX IF NOT EXISTS idx_ledger_office ON office_ledger(office_id);

-- Stripe event idempotency — partial unique (from ensurePerformanceIndexes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_office_ledger_stripe_event_id
  ON office_ledger(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- ── Performance indexes (formerly ensurePerformanceIndexes in index.ts) ────
-- Guarded: tables like tasks/reminders may not exist until later Runtime DDL.
DO $$
DECLARE
  stmt TEXT;
  stmts TEXT[] := ARRAY[
    'CREATE INDEX IF NOT EXISTS idx_cases_office_id ON cases(office_id)',
    'CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)',
    'CREATE INDEX IF NOT EXISTS idx_cases_office_status ON cases(office_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_clients_office_id ON clients(office_id)',
    'CREATE INDEX IF NOT EXISTS idx_documents_office_id ON documents(office_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_office_due ON tasks(office_id, due_date)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
    'CREATE INDEX IF NOT EXISTS idx_reminders_office_due ON reminders(office_id, due_date)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_office_ts ON audit_logs(office_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_revenues_office_date ON revenues(date DESC)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_office_date ON expenses(date DESC)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_office_id ON client_invoices(office_id)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_status ON client_invoices(status)',
    'CREATE INDEX IF NOT EXISTS idx_contracts_office_id ON contracts(office_id)'
  ];
  tbl TEXT;
BEGIN
  FOREACH stmt IN ARRAY stmts LOOP
    -- Extract table name after " ON <table>("
    tbl := substring(stmt from ' ON ([a-z_]+)\(');
    IF tbl IS NOT NULL AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;

COMMIT;
