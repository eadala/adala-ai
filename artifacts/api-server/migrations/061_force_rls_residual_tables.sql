-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 061: FORCE RLS residuals (local / staging only — NOT production-applied here)
-- ADALA-SEC-TENANT-P0-005 / F-TENANT-FORCE / Cron residuals
--
-- Applies FORCE ROW LEVEL SECURITY to public tables that have RLS enabled
-- but lack FORCE (owner-bypass residual from 057/059/060 ENABLE-only stance).
-- Skips tables already FORCE'd. Idempotent.
-- Does NOT change policy quals. Does NOT grant BYPASSRLS.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND c.relforcerowsecurity = false
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', rec.tablename);
    RAISE NOTICE '061_force_rls: FORCE applied to %', rec.tablename;
  END LOOP;
END $$;

DO $$
BEGIN
  RAISE NOTICE '061_force_rls: post-apply READY (reason=FORCE_RLS_RESIDUAL_READY)';
END $$;

COMMIT;
