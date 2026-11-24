-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 060: Fail-closed vault_tenant_isolation (closes 056 empty OR)
--
-- Verified: when vault fail-open coexists with zta fail-closed (both PERMISSIVE),
-- empty tenant still returns all rows (OR of policies). Reproduce evidence in
-- docs/security/RLS_REPRODUCTION_EVIDENCE.md (zta_plus_vault_empty = 2).
--
-- Replaces vault_tenant_isolation quals that allow NULL/'' tenant with:
--   office_id::text = nullif(current_setting('app.current_tenant', true), '')
--   OR current_setting('app.bypass_rls', true) = 'on'
--
-- Does NOT modify historical Migration 056.
-- Does NOT touch zta_tenant_isolation_* (already fail-closed via NULLIF).
-- Does NOT DROP adala_tenant_ok-based vault policies (treat as compatible if
-- helper is fail-closed; BLOCK if helper missing and qual unexpected).
-- Idempotent. No FORCE change.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  rec RECORD;
  existing_qual TEXT;
  is_fail_open BOOLEAN;
  is_fail_closed BOOLEAN;
  uses_helper BOOLEAN;
BEGIN
  FOR rec IN
    SELECT p.tablename
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.policyname = 'vault_tenant_isolation'
    ORDER BY p.tablename
  LOOP
    SELECT p.qual INTO existing_qual
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = rec.tablename
      AND p.policyname = 'vault_tenant_isolation';

    IF existing_qual IS NULL THEN
      CONTINUE;
    END IF;

    uses_helper := existing_qual ~* 'adala_tenant_ok';
    is_fail_closed := (
      existing_qual ~* 'nullif'
      AND existing_qual ~* 'bypass_rls'
      AND existing_qual !~* 'coalesce'
      AND existing_qual !~* 'IS NULL'
    );
    -- Classic 056 fallback fail-open (empty / NULL tenant OR)
    is_fail_open := (
      existing_qual ~* 'bypass_rls'
      AND existing_qual ~* 'current_setting'
      AND existing_qual !~* 'nullif'
      AND (
        existing_qual ~* 'IS NULL'
        OR existing_qual ~* '''''::text'
        OR existing_qual ~* '=\s*'''' '
        OR existing_qual ~* '=\s*'''''
      )
    );

    IF uses_helper THEN
      RAISE NOTICE '060_vault_fail_closed: leave % — uses adala_tenant_ok (verify helper separately)', rec.tablename;
      CONTINUE;
    END IF;

    IF is_fail_closed THEN
      RAISE NOTICE '060_vault_fail_closed: already fail-closed %', rec.tablename;
      CONTINUE;
    END IF;

    IF NOT is_fail_open THEN
      RAISE EXCEPTION
        '060_vault_fail_closed: BLOCK (INCOMPATIBLE_POLICY) — %.vault_tenant_isolation unexpected qual; no DROP.',
        rec.tablename;
    END IF;

    EXECUTE format('DROP POLICY vault_tenant_isolation ON %I', rec.tablename);
    EXECUTE format(
      $p$CREATE POLICY vault_tenant_isolation ON %I
         FOR ALL USING (
           office_id::text = nullif(current_setting('app.current_tenant', true), '')
           OR current_setting('app.bypass_rls', true) = 'on'
         )$p$,
      rec.tablename
    );
    RAISE NOTICE '060_vault_fail_closed: replaced fail-open vault on %', rec.tablename;
  END LOOP;
END $$;

DO $$
BEGIN
  RAISE NOTICE '060_vault_fail_closed: post-apply READY (reason=VAULT_RLS_FAIL_CLOSED_READY)';
END $$;

COMMIT;
