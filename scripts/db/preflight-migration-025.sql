-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 025 — READ-ONLY checks for billing schema authority
--
-- SELECT only. Does not CREATE / ALTER / DROP.
-- Run before applying 025_billing_schema_authority.sql.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 025 preflight: table presence'
SELECT
  t.table_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables i
    WHERE i.table_schema = 'public' AND i.table_name = t.table_name
  ) AS present
FROM (VALUES
  ('office_entitlements'),
  ('platform_billing_invoices'),
  ('office_ledger'),
  ('office_page')
) AS t(table_name)
ORDER BY t.table_name;

\echo '▶ 025 preflight: office_entitlements columns (if present)'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'office_entitlements'
ORDER BY ordinal_position;

\echo '▶ 025 preflight: platform_billing_invoices columns (if present)'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'platform_billing_invoices'
ORDER BY ordinal_position;

\echo '▶ 025 preflight: duplicate (office_id, key) pairs that would block UNIQUE'
SELECT office_id, key, COUNT(*)::int AS n
FROM office_entitlements
WHERE office_id IS NOT NULL AND key IS NOT NULL
GROUP BY office_id, key
HAVING COUNT(*) > 1
ORDER BY n DESC
LIMIT 50;

\echo '▶ 025 preflight: invoice rows missing office_id (will be invisible to tenant-scoped GETs)'
SELECT COUNT(*)::int AS invoices_without_office_id
FROM platform_billing_invoices
WHERE office_id IS NULL;

\echo '▶ 025 preflight: chosen_action'
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'office_entitlements'
    )
     OR NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'platform_billing_invoices'
    )
    THEN 'apply_025_create_missing_tables'
    ELSE 'apply_025_repair_columns_and_indexes'
  END AS chosen_action;

\echo '▶ 025 preflight complete (READ-ONLY)'
