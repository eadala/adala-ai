-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 057 — READ-ONLY monitoring isolation rls_* schema
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 057 preflight: sample rls_* policy on office_branches (non-056-owned)'
SELECT
  to_regclass('public.office_branches') IS NOT NULL AS office_branches_present,
  (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='office_branches') AS office_branches_rls,
  (SELECT EXISTS (
     SELECT 1 FROM pg_policies p
     WHERE p.schemaname='public' AND p.tablename='office_branches'
       AND p.policyname='rls_office_branches'
   )) AS rls_office_branches_present;

\echo '▶ 057 preflight: full contract and decision'
DO $preflight$
DECLARE
  missing_policies TEXT[] := ARRAY[]::TEXT[];
  incompatible_policies TEXT[] := ARRAY[]::TEXT[];
  rls_not_enabled TEXT[] := ARRAY[]::TEXT[];
  action TEXT;
  reason_code TEXT;
  sample_qual TEXT;
  cases_has_056 BOOLEAN;
BEGIN
  IF to_regclass('public.office_branches') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies p
       WHERE p.schemaname='public' AND p.tablename='office_branches'
         AND (p.policyname = 'vault_tenant_isolation'
              OR p.policyname = 'zta_tenant_isolation_office_branches')
     )
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='office_branches' AND c.relrowsecurity
    ) THEN
      rls_not_enabled := array_append(rls_not_enabled, 'office_branches');
    END IF;

    SELECT p.qual INTO sample_qual FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename='office_branches'
      AND p.policyname='rls_office_branches';

    IF sample_qual IS NULL THEN
      missing_policies := array_append(missing_policies, 'rls_office_branches');
    ELSIF sample_qual !~* 'office_id'
       OR sample_qual !~* 'current_setting'
       OR sample_qual !~* 'coalesce'
       OR sample_qual !~* 'bypass_rls' THEN
      incompatible_policies := array_append(incompatible_policies, 'rls_office_branches');
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename='cases'
      AND (p.policyname = 'vault_tenant_isolation'
           OR p.policyname = 'zta_tenant_isolation_cases')
  ) INTO cases_has_056;

  IF cardinality(incompatible_policies) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_POLICY';
    RAISE EXCEPTION '057_isolation_rls preflight: % (reason_code=%)', action, reason_code;
  ELSIF cardinality(rls_not_enabled) > 0 OR cardinality(missing_policies) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_RLS_SCHEMA';
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'MONITORING_ISOLATION_RLS_SCHEMA_READY';
  END IF;

  RAISE NOTICE '057_isolation_rls: chosen_action=% reason_code=% missing_policies=% incompatible_policies=% rls_not_enabled=% cases_has_056=%',
    action, reason_code, missing_policies, incompatible_policies, rls_not_enabled, cases_has_056;
END
$preflight$;
