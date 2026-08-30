-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 057: Monitoring isolation rls_* schema authority (Stage 9)
--
-- Owns former Runtime RLS DDL from:
--   modules/monitoring/isolation.ts — ENABLE RLS + rls_${table}
--
-- Policy semantics preserved exactly from Runtime POST /isolation/enable-rls:
--   ${col}::text = current_setting('app.current_tenant', true)
--   OR coalesce(current_setting('app.current_tenant', true), '') = ''
--   OR current_setting('app.bypass_rls', true) = 'on'
--
-- Skips tables with Migration 056 zta_tenant_isolation_* or vault_tenant_isolation.
-- ENABLE only (no FORCE). Missing tables skipped. Idempotent.
-- Fail-closed on incompatible rls_* qual. No DROP POLICY / no data rewrite.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  rec RECORD;
  pol_name TEXT;
  tenant_col TEXT;
  existing_qual TEXT;
BEGIN
  FOR rec IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = t.tablename
          AND c.column_name IN ('office_id', 'tenant_id')
      )
    ORDER BY t.tablename
  LOOP
    IF to_regclass(format('public.%I', rec.tablename)) IS NULL THEN
      RAISE NOTICE '057_isolation_rls: skip % — table missing', rec.tablename;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = rec.tablename
        AND (
          p.policyname = 'vault_tenant_isolation'
          OR p.policyname = 'zta_tenant_isolation_' || rec.tablename
        )
    ) THEN
      RAISE NOTICE '057_isolation_rls: skip % — Migration 056 zta/vault policy present', rec.tablename;
      CONTINUE;
    END IF;

    SELECT c.column_name INTO tenant_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = rec.tablename
      AND c.column_name IN ('office_id', 'tenant_id')
    ORDER BY CASE c.column_name WHEN 'office_id' THEN 0 ELSE 1 END
    LIMIT 1;

    IF tenant_col IS NULL THEN
      RAISE NOTICE '057_isolation_rls: skip % — no office_id/tenant_id column', rec.tablename;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', rec.tablename);

    pol_name := 'rls_' || rec.tablename;
    SELECT p.qual INTO existing_qual
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = rec.tablename
      AND p.policyname = pol_name;

    IF existing_qual IS NOT NULL THEN
      IF existing_qual !~* tenant_col
         OR existing_qual !~* 'current_setting'
         OR existing_qual !~* 'coalesce'
         OR existing_qual !~* 'bypass_rls' THEN
        RAISE EXCEPTION
          '057_isolation_rls: BLOCK (reason_code=INCOMPATIBLE_POLICY) — %.%.% wrong qual. No DROP POLICY.',
          rec.tablename, pol_name, tenant_col;
      END IF;
    ELSE
      EXECUTE format(
        $p$CREATE POLICY %I ON %I USING (
          %I::text = current_setting('app.current_tenant', true)
          OR coalesce(current_setting('app.current_tenant', true), '') = ''
          OR current_setting('app.bypass_rls', true) = 'on'
        )$p$,
        pol_name, rec.tablename, tenant_col
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  RAISE NOTICE '057_isolation_rls: post-apply FULL READY (reason=MONITORING_ISOLATION_RLS_SCHEMA_READY)';
END $$;

COMMIT;
