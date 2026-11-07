-- Preflight 060 — SELECT-only vault fail-open inventory
\echo '060 preflight: vault_tenant_isolation fail-closed'

SELECT
  COUNT(*) FILTER (
    WHERE p.policyname = 'vault_tenant_isolation'
      AND p.qual ~* 'bypass_rls'
      AND (p.qual ~* 'IS NULL' OR p.qual !~* 'nullif')
      AND p.qual !~* 'adala_tenant_ok'
  ) AS fail_open_vault,
  COUNT(*) FILTER (
    WHERE p.policyname = 'vault_tenant_isolation'
      AND p.qual ~* 'nullif'
      AND p.qual ~* 'bypass_rls'
      AND p.qual !~* 'adala_tenant_ok'
  ) AS fail_closed_vault,
  COUNT(*) FILTER (
    WHERE p.policyname = 'vault_tenant_isolation'
      AND p.qual ~* 'adala_tenant_ok'
  ) AS helper_vault,
  CASE
    WHEN COUNT(*) FILTER (
      WHERE p.policyname = 'vault_tenant_isolation'
        AND p.qual ~* 'bypass_rls'
        AND (p.qual ~* 'IS NULL' OR p.qual !~* 'nullif')
        AND p.qual !~* 'adala_tenant_ok'
    ) > 0 THEN 'SAFE_AUTO_REPAIR'
    WHEN COUNT(*) FILTER (
      WHERE p.policyname = 'vault_tenant_isolation' AND p.qual ~* 'nullif'
    ) > 0 OR COUNT(*) FILTER (
      WHERE p.policyname = 'vault_tenant_isolation'
    ) = 0 THEN 'ALREADY'
    ELSE 'BLOCK_AND_MANUAL_REVIEW'
  END AS status,
  'VAULT_RLS_FAIL_CLOSED_READY' AS ready_token
FROM pg_policies p
WHERE p.schemaname = 'public';
