-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 027 — READ-ONLY checks for event_daily_counts
--
-- SELECT only. Does not CREATE / ALTER / DROP.
-- Run before applying 027_event_daily_counts_schema_authority.sql.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 027 preflight: table presence'
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'event_daily_counts'
  ) AS event_daily_counts_present;

\echo '▶ 027 preflight: event_daily_counts columns (if present)'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'event_daily_counts'
ORDER BY ordinal_position;

\echo '▶ 027 preflight: rows with office_id = default (legacy invent bucket)'
SELECT COUNT(*)::int AS default_office_rows
FROM event_daily_counts
WHERE office_id = 'default';

\echo '▶ 027 preflight: rows with NULL or non-UUID office_id'
SELECT
  COUNT(*) FILTER (WHERE office_id IS NULL)::int AS null_office_id,
  COUNT(*) FILTER (
    WHERE office_id IS NOT NULL
      AND office_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )::int AS non_uuid_office_id,
  COUNT(*)::int AS total_rows
FROM event_daily_counts;

\echo '▶ 027 preflight: duplicate upsert-key groups (block UNIQUE)'
SELECT event_type, office_id, event_date, COUNT(*)::int AS n
FROM event_daily_counts
WHERE event_type IS NOT NULL AND office_id IS NOT NULL AND event_date IS NOT NULL
GROUP BY event_type, office_id, event_date
HAVING COUNT(*) > 1
ORDER BY n DESC
LIMIT 50;

\echo '▶ 027 preflight: chosen_action'
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'event_daily_counts'
    )
    THEN 'apply_027_create_missing_table'
    ELSE 'apply_027_repair_columns_indexes_drop_default'
  END AS chosen_action;

\echo '▶ 027 preflight complete (READ-ONLY)'
