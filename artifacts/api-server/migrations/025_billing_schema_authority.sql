-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 025: Billing schema authority — office_entitlements +
-- platform_billing_invoices (Stage 16.1)
--
-- Confirmed root cause of recurring HTTP 500 on:
--   GET /api/billing/overview
--   GET /api/billing/platform-invoices
--   GET /api/billing/platform-invoices/stats
-- Handlers query these tables, but no prior migration (or Runtime DDL) owned them.
--
-- Source of truth (proven from repo usage):
--   office_entitlements:
--     INSERT/UPDATE/SELECT — tenantProvisioning.ts, entitlements.ts,
--     billing.ts, admin.ts, financialIntelligence.ts
--     ON CONFLICT (office_id, key) — requires UNIQUE (office_id, key)
--     columns: office_id, key, plan, "limit", used, reset_at, updated_at
--   platform_billing_invoices:
--     INSERT/UPDATE/SELECT — billing.ts, admin.ts, webhookHandlers.ts
--     columns: id, office_id, plan_id, plan_name, amount, currency, status,
--              billing_cycle, issue_date, due_date, paid_at, notes, stripe_id,
--              created_at
--
-- Apply AFTER: … → 021 → 023 → 024
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS for fresh DBs
--   - ADD COLUMN IF NOT EXISTS repairs partial legacy tables (no type rewrite,
--     no NOT NULL force, no DROP, no silent cast)
--   - UNIQUE (office_id, key) skipped with WARNING if duplicate pairs exist
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- Do NOT deploy/apply this file from the PR agent — ops apply out-of-band.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── office_entitlements ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_entitlements (
  office_id   TEXT NOT NULL,
  key         TEXT NOT NULL,
  plan        TEXT,
  "limit"     INTEGER NOT NULL DEFAULT 0,
  used        INTEGER NOT NULL DEFAULT 0,
  reset_at    TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT office_entitlements_pkey PRIMARY KEY (office_id, key)
);

ALTER TABLE office_entitlements ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE office_entitlements ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE office_entitlements ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE office_entitlements ADD COLUMN IF NOT EXISTS "limit" INTEGER;
ALTER TABLE office_entitlements ADD COLUMN IF NOT EXISTS used INTEGER;
ALTER TABLE office_entitlements ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ;
ALTER TABLE office_entitlements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE office_entitlements ALTER COLUMN "limit" SET DEFAULT 0;
ALTER TABLE office_entitlements ALTER COLUMN used SET DEFAULT 0;
ALTER TABLE office_entitlements ALTER COLUMN updated_at SET DEFAULT NOW();

-- Unique (office_id, key) for ON CONFLICT — skip with WARNING if duplicates
DO $$
DECLARE
  dup_cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.office_entitlements'::regclass
      AND contype IN ('u', 'p')
      AND (
        pg_get_constraintdef(oid) ILIKE '%(office_id, key)%'
        OR pg_get_constraintdef(oid) ILIKE '%(office_id,%key%)%'
      )
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'office_entitlements_pkey',
        'office_entitlements_office_id_key_key',
        'uq_office_entitlements_office_key'
      )
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_cnt
  FROM (
    SELECT office_id, key
    FROM office_entitlements
    WHERE office_id IS NOT NULL AND key IS NOT NULL
    GROUP BY office_id, key
    HAVING COUNT(*) > 1
  ) d;

  IF dup_cnt > 0 THEN
    RAISE WARNING
      '025_billing: skipping UNIQUE(office_id, key) — % duplicate pair(s); cleanup required before constraint can be added',
      dup_cnt;
  ELSE
    BEGIN
      ALTER TABLE office_entitlements
        ADD CONSTRAINT uq_office_entitlements_office_key UNIQUE (office_id, key);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN invalid_table_definition THEN NULL;
    END;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_office_entitlements_office_id
  ON office_entitlements (office_id);

-- ── platform_billing_invoices ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_billing_invoices (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id      TEXT,
  plan_id        TEXT,
  plan_name      TEXT,
  amount         NUMERIC,
  currency       TEXT DEFAULT 'SAR',
  status         TEXT DEFAULT 'unpaid',
  billing_cycle  TEXT DEFAULT 'monthly',
  issue_date     TIMESTAMPTZ DEFAULT NOW(),
  due_date       TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  notes          TEXT,
  stripe_id      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS plan_name TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS billing_cycle TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS issue_date TIMESTAMPTZ;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS stripe_id TEXT;
ALTER TABLE platform_billing_invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE platform_billing_invoices ALTER COLUMN currency SET DEFAULT 'SAR';
ALTER TABLE platform_billing_invoices ALTER COLUMN status SET DEFAULT 'unpaid';
ALTER TABLE platform_billing_invoices ALTER COLUMN billing_cycle SET DEFAULT 'monthly';
ALTER TABLE platform_billing_invoices ALTER COLUMN issue_date SET DEFAULT NOW();
ALTER TABLE platform_billing_invoices ALTER COLUMN created_at SET DEFAULT NOW();

-- Query-path indexes (tenant list, status filters, unpaid due-date ordering)
CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_office_id
  ON platform_billing_invoices (office_id);

CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_status
  ON platform_billing_invoices (status);

CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_due_date
  ON platform_billing_invoices (due_date);

CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_office_status
  ON platform_billing_invoices (office_id, status);

CREATE INDEX IF NOT EXISTS idx_platform_billing_invoices_office_due
  ON platform_billing_invoices (office_id, due_date);

COMMIT;
