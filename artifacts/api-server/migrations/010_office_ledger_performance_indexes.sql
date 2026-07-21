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
-- ensurePerformanceIndexes() in artifacts/api-server/src/index.ts — only for
-- tables that already exist in migrations 001–009 (cases, clients, documents,
-- audit_logs, revenues, expenses, client_invoices, contracts).
--
-- NOT owned here (deferred to the future numbered migration that creates the
-- tables): idx_tasks_office_due, idx_tasks_status, idx_reminders_office_due.
-- Do NOT re-run this migration later to obtain those indexes.
--
-- Apply AFTER: 003 → 001 → 004 → 005 → 006 → 007 → 008 → 009
-- Idempotent / legacy-safe:
--   - ADD COLUMN IF NOT EXISTS repairs partial tables (no type rewrite, no NOT NULL force)
--   - type CHECK skipped with WARNING if invalid legacy type values exist
--   - unique stripe_event_id index skipped with WARNING if duplicate non-null values exist
--   - column repairs still COMMIT when CHECK/index are skipped
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── office_ledger ──────────────────────────────────────────────────────────
-- Fresh DBs get full definition. Existing tables skip CREATE; columns repaired below.
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

-- Idempotent column adds for older/partial production tables (nullable — no NOT NULL force)
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

-- Defaults for fee columns (match production / billing expectations; do not rewrite rows)
ALTER TABLE office_ledger ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE office_ledger ALTER COLUMN platform_fee SET DEFAULT 0;
ALTER TABLE office_ledger ALTER COLUMN stripe_fee SET DEFAULT 0;
ALTER TABLE office_ledger ALTER COLUMN net_amount SET DEFAULT 0;
ALTER TABLE office_ledger ALTER COLUMN created_at SET DEFAULT NOW();

-- type CHECK — preflight: skip with WARNING if invalid legacy non-null type values exist
DO $$
DECLARE
  invalid_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.office_ledger'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%credit%debit%refund%'
  ) THEN
    SELECT COUNT(*) INTO invalid_cnt
    FROM office_ledger
    WHERE type IS NOT NULL
      AND type NOT IN ('credit', 'debit', 'refund');

    IF invalid_cnt > 0 THEN
      RAISE WARNING
        '010_office_ledger: skipping type CHECK — % row(s) have type outside (credit, debit, refund); cleanup required before constraint can be added',
        invalid_cnt;
    ELSE
      ALTER TABLE office_ledger
        ADD CONSTRAINT office_ledger_type_check
        CHECK (type = ANY (ARRAY['credit'::text, 'debit'::text, 'refund'::text]));
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- office_id lookup index (present on production)
CREATE INDEX IF NOT EXISTS idx_ledger_office ON office_ledger(office_id);

-- Stripe event idempotency — preflight: skip unique index if duplicate non-null stripe_event_id exist
DO $$
DECLARE
  dup_cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_office_ledger_stripe_event_id'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_cnt
  FROM (
    SELECT stripe_event_id
    FROM office_ledger
    WHERE stripe_event_id IS NOT NULL
    GROUP BY stripe_event_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_cnt > 0 THEN
    RAISE WARNING
      '010_office_ledger: skipping idx_office_ledger_stripe_event_id — % duplicate non-null stripe_event_id value(s); duplicate cleanup required before unique index can be added',
      dup_cnt;
  ELSE
    EXECUTE $idx$
      CREATE UNIQUE INDEX idx_office_ledger_stripe_event_id
        ON office_ledger(stripe_event_id)
        WHERE stripe_event_id IS NOT NULL
    $idx$;
  END IF;
END $$;

-- ── Performance indexes for tables owned by migrations 001–009 ─────────────
-- tasks/reminders indexes intentionally omitted — add them in the future
-- numbered migration that formally CREATEs those tables.
CREATE INDEX IF NOT EXISTS idx_cases_office_id       ON cases(office_id);
CREATE INDEX IF NOT EXISTS idx_cases_status          ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_office_status   ON cases(office_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_office_id     ON clients(office_id);
CREATE INDEX IF NOT EXISTS idx_documents_office_id   ON documents(office_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_office_ts  ON audit_logs(office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenues_office_date  ON revenues(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_office_date  ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_office_id    ON client_invoices(office_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON client_invoices(status);
CREATE INDEX IF NOT EXISTS idx_contracts_office_id   ON contracts(office_id);

COMMIT;
