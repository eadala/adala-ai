-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 001: Tenant Isolation — office_id columns + indexes + backfill
-- Safe: only touches tables that exist (boot-created tables may appear later).
-- Apply after 003:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/api-server/migrations/001_tenant_isolation.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Step 1: Add office_id column (guarded — table must exist) ───────────────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'cases', 'clients', 'contracts', 'client_invoices', 'employees',
    'tasks', 'revenues', 'expenses', 'legal_documents', 'audit_logs',
    'documents', 'arbitration_cases', 'employee_warnings',
    'employee_investigations', 'document_signatures', 'case_timeline',
    'compliance_items', 'ai_agent_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS office_id TEXT', t);
    END IF;
  END LOOP;
END $$;

-- ── Step 2: Indexes (guarded) ─────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT unnest(ARRAY[
      'cases', 'clients', 'contracts', 'client_invoices', 'employees',
      'tasks', 'revenues', 'expenses', 'legal_documents', 'audit_logs',
      'documents', 'arbitration_cases', 'compliance_items'
    ]) AS tbl
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = rec.tbl
    ) THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_office_id ON %I(office_id)',
        rec.tbl, rec.tbl
      );
    END IF;
  END LOOP;
END $$;

-- ── Step 3: Backfill — assign existing records to first office_page row ─────
DO $$
DECLARE
  prod_office TEXT;
  t TEXT;
  tables TEXT[] := ARRAY[
    'cases', 'clients', 'contracts', 'client_invoices', 'employees',
    'tasks', 'revenues', 'expenses', 'legal_documents', 'audit_logs',
    'documents', 'arbitration_cases', 'employee_warnings',
    'employee_investigations', 'document_signatures', 'case_timeline',
    'compliance_items', 'ai_agent_logs'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'office_page'
  ) THEN
    RAISE WARNING 'office_page not found — skipping backfill';
    RETURN;
  END IF;

  SELECT id::text INTO prod_office FROM office_page ORDER BY created_at LIMIT 1;
  IF prod_office IS NULL THEN
    RAISE WARNING 'No office found in office_page — skipping backfill';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'office_id'
    ) THEN
      EXECUTE format(
        'UPDATE %I SET office_id = $1 WHERE office_id IS NULL',
        t
      ) USING prod_office;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled office_id to office: %', prod_office;
END $$;

COMMIT;
