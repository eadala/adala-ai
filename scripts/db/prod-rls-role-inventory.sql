-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCTION READ-ONLY — RLS / role / ownership inventory
-- Safe: SELECT / catalog probes only. No DDL/DML. Do not apply as migration.
-- Run as a read-only DBA role against production (or a restore clone).
-- ═══════════════════════════════════════════════════════════════════════════

\echo '=== 1. Current session identity ==='
SELECT current_user, session_user, current_database(), inet_server_addr(), now() AT TIME ZONE 'Asia/Riyadh' AS now_riyadh;

\echo '=== 2. Application-like roles (adjust names to match prod) ==='
SELECT
  r.rolname,
  r.rolsuper,
  r.rolbypassrls,
  r.rolcanlogin,
  r.rolinherit,
  r.rolcreaterole,
  r.rolcreatedb,
  ARRAY(SELECT b.rolname FROM pg_auth_members m
        JOIN pg_roles b ON b.oid = m.roleid
        WHERE m.member = r.oid) AS member_of
FROM pg_roles r
WHERE r.rolname IN (
  'adala_app', 'adala', 'app', 'api', 'postgres',
  current_user
)
OR r.rolname ILIKE '%adala%'
OR r.rolname ILIKE '%app%'
ORDER BY r.rolname;

\echo '=== 3. Who owns tenant-sensitive tables? ==='
SELECT
  n.nspname AS schema,
  c.relname AS table,
  pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'cases','clients','contracts','documents','invitations','notifications',
    'office_members','offices','client_invoices','payment_transactions',
    'stripe_events','office_messages','storage_files','ai_credits'
  )
ORDER BY c.relname;

\echo '=== 4. FORCE / RLS coverage summary ==='
SELECT
  COUNT(*) FILTER (WHERE c.relrowsecurity) AS rls_on,
  COUNT(*) FILTER (WHERE c.relforcerowsecurity) AS force_on,
  COUNT(*) FILTER (WHERE c.relrowsecurity AND NOT c.relforcerowsecurity) AS rls_without_force,
  COUNT(*) AS tables_scanned
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

\echo '=== 5. Policy inventory (rls_ / vault_ / zta_) ==='
SELECT
  schemaname, tablename, policyname, permissive, roles, cmd,
  left(qual, 160) AS using_preview,
  left(with_check::text, 80) AS with_check_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE 'rls_%'
    OR policyname LIKE 'vault_%'
    OR policyname LIKE 'zta_%'
  )
ORDER BY tablename, policyname;

\echo '=== 6. Fail-open residual scan (empty OR / coalesce empty) ==='
SELECT tablename, policyname,
  CASE
    WHEN qual ~* 'coalesce\(current_setting\(''app\.current_tenant''' THEN 'COALESCE_EMPTY'
    WHEN qual ~* 'IS NULL' AND qual ~* 'current_setting\(''app\.current_tenant''' THEN 'NULL_OR'
    WHEN qual ~* 'current_setting\(''app\.current_tenant''[^)]*\)\s*=\s*''''' THEN 'EMPTY_EQ'
    WHEN qual ~* 'nullif\(current_setting\(''app\.current_tenant''' THEN 'NULLIF_OK'
    ELSE 'OTHER'
  END AS shape,
  left(qual, 120) AS qual_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND (policyname LIKE 'rls_%' OR policyname LIKE 'vault_%' OR policyname LIKE 'zta_%')
ORDER BY shape, tablename;

\echo '=== 7. SECURITY DEFINER functions (privileged) ==='
SELECT
  n.nspname AS schema,
  p.proname AS function,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proconfig AS config_guaranteed
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND p.prosecdef = true
ORDER BY 1, 2;

\echo '=== 8. Table privileges for login role(s) ==='
SELECT
  g.grantee,
  g.table_schema,
  g.table_name,
  string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type) AS privileges
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.grantee IN ('adala_app', 'PUBLIC', current_user)
  AND g.table_name IN (
    'cases','clients','invitations','notifications','stripe_events'
  )
GROUP BY 1,2,3
ORDER BY 1,3;

\echo '=== 9. BLOCKER heuristics (interpret manually) ==='
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_roles
      WHERE rolcanlogin AND rolbypassrls
        AND rolname NOT IN ('postgres')
        AND (rolname ILIKE '%app%' OR rolname ILIKE '%adala%')
    ) THEN 'BLOCKER_CANDIDATE: login app-like role has BYPASSRLS'
    ELSE 'OK_heuristic: no app-like login role with BYPASSRLS'
  END AS bypass_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
        AND c.relrowsecurity AND NOT c.relforcerowsecurity
        AND pg_get_userbyid(c.relowner) IN (
          SELECT rolname FROM pg_roles WHERE rolcanlogin AND (rolname ILIKE '%app%' OR rolname ILIKE '%adala%')
        )
    ) THEN 'RISK: app login role owns RLS tables without FORCE (owner bypasses RLS)'
    ELSE 'OK_heuristic_or_unknown: no app-owned RLS tables without FORCE (or naming mismatch)'
  END AS owner_force_check;
