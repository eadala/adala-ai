-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 059: Fail-closed RLS — remove empty/missing tenant OR-bypass
--
-- ADR-001. Replaces rls_* policies that allow:
--   OR coalesce(current_setting('app.current_tenant', true), '') = ''
-- with:
--   office_id/tenant_id match via nullif(..., '')
--   OR app.bypass_rls = 'on'
--
-- Skips tables with Migration 056 vault_tenant_isolation / zta_tenant_isolation_*
-- (those remain documented REQUIRES ADAPTATION — do not silently DROP).
-- ENABLE only (no FORCE) — preserves 057 stance on table-owner semantics.
-- Idempotent: if policy already fail-closed (nullif + bypass, no empty coalesce),
-- leave it. DROP POLICY only when replacing known fail-open rls_* qual.
-- Application MUST set bypass_rls for Super Admin / signed system jobs
-- and must not clear tenant to '' (use __unscoped__ sentinel).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  rec RECORD;
  pol_name TEXT;
  tenant_col TEXT;
  existing_qual TEXT;
  is_fail_open BOOLEAN;
  is_fail_closed BOOLEAN;
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
      RAISE NOTICE '059_fail_closed: skip % — 056 vault/zta policy present (manual follow-up)', rec.tablename;
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
      CONTINUE;
    END IF;

    pol_name := 'rls_' || rec.tablename;

    SELECT p.qual INTO existing_qual
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = rec.tablename
      AND p.policyname = pol_name;

    IF existing_qual IS NULL THEN
      -- Create fail-closed policy if RLS enabled and no rls_* yet
      IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = rec.tablename AND c.relrowsecurity
      ) THEN
        EXECUTE format(
          $p$CREATE POLICY %I ON %I USING (
            %I::text = nullif(current_setting('app.current_tenant', true), '')
            OR current_setting('app.bypass_rls', true) = 'on'
          )$p$,
          pol_name, rec.tablename, tenant_col
        );
        RAISE NOTICE '059_fail_closed: created % on %', pol_name, rec.tablename;
      END IF;
      CONTINUE;
    END IF;

    is_fail_open := (
      existing_qual ~* 'coalesce'
      AND existing_qual ~* 'current_setting'
      AND existing_qual ~* 'bypass_rls'
    );
    is_fail_closed := (
      existing_qual ~* 'nullif'
      AND existing_qual ~* 'bypass_rls'
      AND existing_qual !~* 'coalesce'
    );

    IF is_fail_closed THEN
      RAISE NOTICE '059_fail_closed: already fail-closed %', pol_name;
      CONTINUE;
    END IF;

    IF NOT is_fail_open THEN
      RAISE EXCEPTION
        '059_fail_closed: BLOCK (INCOMPATIBLE_POLICY) — %.% unexpected qual; no DROP. Manual review required.',
        rec.tablename, pol_name;
    END IF;

    EXECUTE format('DROP POLICY %I ON %I', pol_name, rec.tablename);
    EXECUTE format(
      $p$CREATE POLICY %I ON %I USING (
        %I::text = nullif(current_setting('app.current_tenant', true), '')
        OR current_setting('app.bypass_rls', true) = 'on'
      )$p$,
      pol_name, rec.tablename, tenant_col
    );
    RAISE NOTICE '059_fail_closed: replaced fail-open % on %', pol_name, rec.tablename;
  END LOOP;
END $$;

DO $$
BEGIN
  RAISE NOTICE '059_fail_closed: post-apply READY (reason=RLS_FAIL_CLOSED_EMPTY_TENANT_READY)';
END $$;

COMMIT;
