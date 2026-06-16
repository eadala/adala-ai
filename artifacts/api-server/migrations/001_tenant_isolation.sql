-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 001: Tenant Isolation — office_id columns + indexes + backfill
-- Run: psql $DATABASE_URL -f migrations/001_tenant_isolation.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Step 1: Add office_id column to all tables that need it ────────────────
ALTER TABLE cases               ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE clients             ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE contracts           ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE client_invoices     ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE employees           ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE tasks               ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE revenues            ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE expenses            ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE legal_documents     ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE audit_logs          ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE documents           ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE arbitration_cases   ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE employee_warnings   ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE employee_investigations ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE document_signatures ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE case_timeline       ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE compliance_items    ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE ai_agent_logs       ADD COLUMN IF NOT EXISTS office_id TEXT;

-- ── Step 2: Create indexes for query performance ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_cases_office_id               ON cases(office_id);
CREATE INDEX IF NOT EXISTS idx_clients_office_id             ON clients(office_id);
CREATE INDEX IF NOT EXISTS idx_contracts_office_id           ON contracts(office_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_office_id     ON client_invoices(office_id);
CREATE INDEX IF NOT EXISTS idx_employees_office_id           ON employees(office_id);
CREATE INDEX IF NOT EXISTS idx_tasks_office_id               ON tasks(office_id);
CREATE INDEX IF NOT EXISTS idx_revenues_office_id            ON revenues(office_id);
CREATE INDEX IF NOT EXISTS idx_expenses_office_id            ON expenses(office_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_office_id     ON legal_documents(office_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_office_id          ON audit_logs(office_id);
CREATE INDEX IF NOT EXISTS idx_documents_office_id           ON documents(office_id);
CREATE INDEX IF NOT EXISTS idx_arbitration_cases_office_id   ON arbitration_cases(office_id);
CREATE INDEX IF NOT EXISTS idx_compliance_items_office_id    ON compliance_items(office_id);

-- ── Step 3: Backfill — assign existing records to the production office ────
-- IMPORTANT: Replace 'YOUR_PRODUCTION_OFFICE_ID' with the real office UUID
-- To find it: SELECT id FROM office_page LIMIT 1;
DO $$
DECLARE
  prod_office TEXT;
BEGIN
  SELECT id::text INTO prod_office FROM office_page ORDER BY created_at LIMIT 1;
  IF prod_office IS NOT NULL THEN
    UPDATE cases               SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE clients             SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE contracts           SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE client_invoices     SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE employees           SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE tasks               SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE revenues            SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE expenses            SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE legal_documents     SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE audit_logs          SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE documents           SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE arbitration_cases   SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE employee_warnings   SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE employee_investigations SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE document_signatures SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE case_timeline       SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE compliance_items    SET office_id = prod_office WHERE office_id IS NULL;
    UPDATE ai_agent_logs       SET office_id = prod_office WHERE office_id IS NULL;
    RAISE NOTICE 'Backfilled all NULL office_id records to office: %', prod_office;
  ELSE
    RAISE WARNING 'No office found in office_page — skipping backfill';
  END IF;
END $$;

COMMIT;
