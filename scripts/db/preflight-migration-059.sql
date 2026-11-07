-- Preflight 059 — SELECT-only.
\echo '059 preflight: fail-closed rls_* empty-tenant removal'

SELECT
  COUNT(*) FILTER (
    WHERE p.qual ~* 'coalesce'
      AND p.qual ~* 'bypass_rls'
      AND p.policyname LIKE 'rls_%'
  ) AS fail_open_rls_policies,
  COUNT(*) FILTER (
    WHERE p.qual ~* 'nullif'
      AND p.qual ~* 'bypass_rls'
      AND p.qual !~* 'coalesce'
      AND p.policyname LIKE 'rls_%'
  ) AS fail_closed_rls_policies,
  CASE
    WHEN COUNT(*) FILTER (
      WHERE p.qual ~* 'coalesce' AND p.qual ~* 'bypass_rls' AND p.policyname LIKE 'rls_%'
    ) = 0
    AND COUNT(*) FILTER (
      WHERE p.qual ~* 'nullif' AND p.qual ~* 'bypass_rls' AND p.qual !~* 'coalesce' AND p.policyname LIKE 'rls_%'
    ) > 0
      THEN 'ALREADY'
    WHEN COUNT(*) FILTER (
      WHERE p.qual ~* 'coalesce' AND p.qual ~* 'bypass_rls' AND p.policyname LIKE 'rls_%'
    ) > 0
      THEN 'SAFE_AUTO_REPAIR'
    ELSE 'BLOCK_AND_MANUAL_REVIEW'
  END AS status,
  'RLS_FAIL_CLOSED_EMPTY_TENANT_READY' AS ready_token
FROM pg_policies p
WHERE p.schemaname = 'public';
