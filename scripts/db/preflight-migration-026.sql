-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 026 — READ-ONLY checks for promo schema authority
--
-- SELECT only. Does not CREATE / ALTER / DROP.
-- Run before applying 026_promo_schema_authority.sql.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 026 preflight: table presence'
SELECT
  t.table_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables i
    WHERE i.table_schema = 'public' AND i.table_name = t.table_name
  ) AS present
FROM (VALUES
  ('promo_codes'),
  ('gift_subscriptions')
) AS t(table_name)
ORDER BY t.table_name;

\echo '▶ 026 preflight: promo_codes columns (if present)'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'promo_codes'
ORDER BY ordinal_position;

\echo '▶ 026 preflight: gift_subscriptions columns (if present)'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'gift_subscriptions'
ORDER BY ordinal_position;

\echo '▶ 026 preflight: duplicate promo codes that would block UNIQUE(code)'
SELECT code, COUNT(*)::int AS n
FROM promo_codes
WHERE code IS NOT NULL
GROUP BY code
HAVING COUNT(*) > 1
ORDER BY n DESC
LIMIT 50;

\echo '▶ 026 preflight: active gifts visible to GET /promo/my-gift'
SELECT COUNT(*)::int AS active_gifts
FROM gift_subscriptions
WHERE status = 'active' AND end_date > NOW();

\echo '▶ 026 preflight: chosen_action'
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'promo_codes'
    )
     OR NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'gift_subscriptions'
    )
    THEN 'apply_026_create_missing_tables'
    ELSE 'apply_026_repair_columns_and_indexes'
  END AS chosen_action;

\echo '▶ 026 preflight complete (READ-ONLY)'
