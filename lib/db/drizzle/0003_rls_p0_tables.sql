-- PR-DATA-001: Row-Level Security on P0 tenant-scoped tables
-- Session variable: app.current_tenant (set by requireAuthWithTenant)
-- Fail-closed: empty session → no rows match policy

CREATE OR REPLACE FUNCTION adala_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION adala_rls_bypass() RETURNS BOOLEAN AS $$
  SELECT current_setting('app.bypass_rls', true) = 'true';
$$ LANGUAGE SQL STABLE;

-- Helper macro pattern for tenant isolation policy
DO $rls$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'cases',
    'clients',
    'client_invoices',
    'contracts',
    'documents',
    'employees',
    'journal_entries',
    'invoice_payments',
    'office_entitlements',
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS adala_tenant_isolation ON %I', t);
    EXECUTE format($pol$
      CREATE POLICY adala_tenant_isolation ON %I
        USING (
          adala_rls_bypass()
          OR (
            adala_tenant_id() IS NOT NULL
            AND office_id = adala_tenant_id()
          )
        )
        WITH CHECK (
          adala_rls_bypass()
          OR (
            adala_tenant_id() IS NOT NULL
            AND office_id = adala_tenant_id()
          )
        )
    $pol$, t);
  END LOOP;
END;
$rls$;
