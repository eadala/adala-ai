-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 056: RLS Runtime schema authority (Stage 9)
--
-- Owns former Runtime RLS DDL from:
--   security/rls-migration.ts  — ENABLE + FORCE RLS + zta_tenant_isolation_*
--   modules/platform/dataVault.ts — ENABLE RLS + vault_tenant_isolation
--                                  + security_events / rls_enablement_log
--
-- zero-trust-router.ts has no DDL; routes keep SA guards and call readiness.
--
-- Policy semantics preserved exactly from Runtime (no DROP POLICY / no data rewrite).
-- Missing tables skipped (same as Runtime). office_erp_ledger RLS remains 013.
-- Idempotent. Fail-closed on incompatible policy qual. No DROP TABLE / DROP INDEX.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Supporting tables (dataVault ensureSecurityTables) ────────────────────
CREATE TABLE IF NOT EXISTS security_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  office_id   TEXT,
  user_id     TEXT,
  ip_address  TEXT,
  meta        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type    ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_office  ON security_events(office_id);

CREATE TABLE IF NOT EXISTS rls_enablement_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  enabled_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Zero Trust RLS (rls-migration.ts) — ENABLE + FORCE + zta_tenant_isolation_*
-- USING (office_id = NULLIF(current_setting('app.current_tenant', true), ''))
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  zta_tables CONSTANT TEXT[] := ARRAY[
    'cases','clients','contracts','client_invoices','documents',
    'ai_tasks','tasks','reminders','case_sessions','employees',
    'payroll','revenues','expenses','bank_accounts','cash_advances',
    'audit_logs','login_logs','storage_files',
    'org_units','org_members','office_messages','message_recipients',
    'legal_documents','document_signatures','employee_leaves',
    'performance_evaluations','employee_incentives'
  ]::TEXT[];
  tbl TEXT;
  pol TEXT;
  existing_qual TEXT;
BEGIN
  FOREACH tbl IN ARRAY zta_tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE '056_rls: skip ZTA % — table missing', tbl;
      CONTINUE;
    END IF;

    -- Require office_id column (Runtime policies assume it)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=tbl AND column_name='office_id'
    ) THEN
      RAISE NOTICE '056_rls: skip ZTA % — no office_id column', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    pol := 'zta_tenant_isolation_' || tbl;
    SELECT p.qual INTO existing_qual
    FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename=tbl AND p.policyname=pol;

    IF existing_qual IS NOT NULL THEN
      IF existing_qual !~* 'office_id' OR existing_qual !~* 'current_setting' THEN
        RAISE EXCEPTION
          '056_rls: BLOCK (reason_code=INCOMPATIBLE_POLICY) — %.% wrong qual. No DROP POLICY.',
          tbl, pol;
      END IF;
    ELSE
      EXECUTE format(
        $p$CREATE POLICY %I ON %I USING (
          office_id = NULLIF(current_setting('app.current_tenant', true), '')
        )$p$,
        pol, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Data Vault RLS (dataVault.ts) — ENABLE + vault_tenant_isolation
-- Proven greenfield path (adala_tenant_ok absent): FOR ALL USING fallback
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  vault_tables CONSTANT TEXT[] := ARRAY[
    'cases','clients','contracts','documents','employees',
    'tasks','reminders','audit_logs','login_logs',
    'ai_tasks','ai_credit_transactions',
    'chart_of_accounts','office_ledger','revenues','expenses',
    'client_invoices','payroll','bank_accounts','cash_advances',
    'telegram_settings','telegram_logs','whatsapp_settings','whatsapp_logs',
    'office_ai_credits','office_members','office_team',
    'office_services','office_orders','office_articles','office_reviews',
    'office_api_keys','office_stripe_accounts','office_storage_quota',
    'studio_api_keys','studio_custom_tables',
    'system_events','email_notification_settings','email_notification_logs',
    'onboarding_state','push_subscriptions',
    'copilot_memory','document_signatures','document_templates',
    'case_ai_insights','case_autopilot_reports','case_timeline',
    'compliance_items','arbitration_cases','mediator_tasks',
    'checkout_settings','moyasar_settings',
    'client_case_links','client_comm_settings',
    'employee_investigations','employee_warnings',
    'platform_billing_invoices','office_domains','office_entitlements'
  ]::TEXT[];
  tbl TEXT;
  existing_qual TEXT;
  use_helper BOOLEAN;
BEGIN
  use_helper := EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'adala_tenant_ok' LIMIT 1);

  FOREACH tbl IN ARRAY vault_tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE '056_rls: skip vault % — table missing', tbl;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=tbl AND column_name='office_id'
    ) THEN
      RAISE NOTICE '056_rls: skip vault % — no office_id column', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    SELECT p.qual INTO existing_qual
    FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename=tbl AND p.policyname='vault_tenant_isolation';

    IF existing_qual IS NOT NULL THEN
      IF use_helper THEN
        IF existing_qual !~* 'adala_tenant_ok' THEN
          RAISE EXCEPTION
            '056_rls: BLOCK (reason_code=INCOMPATIBLE_POLICY) — %.vault_tenant_isolation expected adala_tenant_ok. No DROP POLICY.',
            tbl;
        END IF;
      ELSE
        IF existing_qual !~* 'current_setting' OR existing_qual !~* 'bypass_rls' THEN
          -- Allow adala_tenant_ok-shaped policies if helper was added later
          IF existing_qual !~* 'adala_tenant_ok' THEN
            RAISE EXCEPTION
              '056_rls: BLOCK (reason_code=INCOMPATIBLE_POLICY) — %.vault_tenant_isolation wrong qual. No DROP POLICY.',
              tbl;
          END IF;
        END IF;
      END IF;
    ELSE
      IF use_helper THEN
        EXECUTE format(
          $p$CREATE POLICY vault_tenant_isolation ON %I
             FOR ALL USING (adala_tenant_ok(office_id))$p$,
          tbl
        );
      ELSE
        EXECUTE format(
          $p$CREATE POLICY vault_tenant_isolation ON %I
             FOR ALL USING (
               office_id::text = current_setting('app.current_tenant', true)
               OR current_setting('app.current_tenant', true) IS NULL
               OR current_setting('app.current_tenant', true) = ''
               OR current_setting('app.bypass_rls', true) = 'on'
             )$p$,
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- Fail-closed index shapes for security_events (Runtime CREATE INDEX IF NOT EXISTS)
DO $$
DECLARE
  spec RECORD;
  expected_table_oid OID;
  actual_table_oid OID;
  index_columns TEXT[];
  index_options INT[];
  desc_ok BOOLEAN;
  opt_i INT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_security_events_type', 'security_events', ARRAY['event_type']::text[], FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type)$c$),
      ('idx_security_events_created', 'security_events', ARRAY['created_at']::text[], TRUE,
        $c$CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC)$c$),
      ('idx_security_events_office', 'security_events', ARRAY['office_id']::text[], FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_security_events_office ON security_events(office_id)$c$)
    ) AS t(index_name, table_name, expected_cols, expect_last_desc, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    SELECT x.indrelid,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality))
    INTO actual_table_oid, index_columns, index_options
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=spec.index_name;

    IF FOUND THEN
      desc_ok := true;
      IF index_options IS NULL
         OR cardinality(index_options) IS DISTINCT FROM cardinality(spec.expected_cols) THEN
        desc_ok := false;
      ELSE
        FOR opt_i IN 1 .. cardinality(spec.expected_cols) LOOP
          IF opt_i = cardinality(spec.expected_cols) AND spec.expect_last_desc THEN
            IF (index_options[opt_i] & 1) IS DISTINCT FROM 1 THEN desc_ok := false; END IF;
          ELSE
            IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
          END IF;
        END LOOP;
      END IF;
      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_columns IS DISTINCT FROM spec.expected_cols
         OR desc_ok IS NOT TRUE THEN
        RAISE EXCEPTION
          '056_rls: BLOCK (reason_code=INCOMPATIBLE_INDEX) — % incompatible. No DROP INDEX.',
          spec.index_name;
      END IF;
    ELSE
      IF expected_table_oid IS NULL THEN CONTINUE; END IF;
      EXECUTE spec.create_sql;
    END IF;
  END LOOP;
END $$;

-- Post-apply readiness
DO $$
DECLARE
  cases_rls BOOLEAN;
  cases_force BOOLEAN;
  zta_pol BOOLEAN;
  vault_pol BOOLEAN;
BEGIN
  IF to_regclass('public.security_events') IS NULL
     OR to_regclass('public.rls_enablement_log') IS NULL THEN
    RAISE EXCEPTION '056_rls: POST_APPLY_READINESS_FAILED — supporting tables missing';
  END IF;
  IF to_regclass('public.idx_security_events_type') IS NULL
     OR to_regclass('public.idx_security_events_created') IS NULL
     OR to_regclass('public.idx_security_events_office') IS NULL THEN
    RAISE EXCEPTION '056_rls: POST_APPLY_READINESS_FAILED — security_events indexes missing';
  END IF;

  -- Core ZTA sample (cases always owned by baseline migrations)
  IF to_regclass('public.cases') IS NOT NULL THEN
    SELECT c.relrowsecurity, c.relforcerowsecurity INTO cases_rls, cases_force
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='cases';
    IF cases_rls IS NOT TRUE OR cases_force IS NOT TRUE THEN
      RAISE EXCEPTION '056_rls: POST_APPLY_READINESS_FAILED — cases RLS/FORCE not set';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='cases'
        AND policyname='zta_tenant_isolation_cases'
    ) INTO zta_pol;
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='cases'
        AND policyname='vault_tenant_isolation'
    ) INTO vault_pol;
    IF zta_pol IS NOT TRUE OR vault_pol IS NOT TRUE THEN
      RAISE EXCEPTION '056_rls: POST_APPLY_READINESS_FAILED — cases policies missing';
    END IF;
  END IF;

  RAISE NOTICE '056_rls: post-apply FULL READY (reason=RLS_RUNTIME_SCHEMA_READY)';
END $$;

COMMIT;
