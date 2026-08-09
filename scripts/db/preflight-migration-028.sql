-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 028 — READ-ONLY checks for case_autopilot_reports
--
-- SELECT only. Does not CREATE / ALTER / DROP.
-- Run before applying 028_case_autopilot_reports_schema_authority.sql.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 028 preflight: table presence'
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'case_autopilot_reports'
  ) AS case_autopilot_reports_present;

\echo '▶ 028 preflight: case_autopilot_reports columns (if present)'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'case_autopilot_reports'
ORDER BY ordinal_position;

\echo '▶ 028 preflight: rows with office_id = default (legacy invent bucket)'
SELECT COUNT(*)::int AS default_office_rows
FROM case_autopilot_reports
WHERE office_id = 'default';

\echo '▶ 028 preflight: rows with NULL or non-UUID office_id'
SELECT
  COUNT(*) FILTER (WHERE office_id IS NULL)::int AS null_office_id,
  COUNT(*) FILTER (
    WHERE office_id IS NOT NULL
      AND office_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )::int AS non_uuid_office_id,
  COUNT(*) FILTER (WHERE case_id IS NULL)::int AS null_case_id,
  COUNT(*)::int AS total_rows
FROM case_autopilot_reports;

\echo '▶ 028 preflight: duplicate case_id groups (block PRIMARY KEY)'
SELECT case_id, COUNT(*)::int AS n
FROM case_autopilot_reports
WHERE case_id IS NOT NULL
GROUP BY case_id
HAVING COUNT(*) > 1
ORDER BY n DESC
LIMIT 50;

\echo '▶ 028 preflight: chosen_action'
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'case_autopilot_reports'
    )
    THEN 'apply_028_create_missing_table'
    WHEN EXISTS (
      SELECT 1 FROM case_autopilot_reports WHERE case_id IS NULL
    )
      OR EXISTS (
        SELECT 1
        FROM (
          SELECT case_id
          FROM case_autopilot_reports
          WHERE case_id IS NOT NULL
          GROUP BY case_id
          HAVING COUNT(*) > 1
        ) d
      )
    THEN 'BLOCKED_CLEAN_DUPLICATES'
    ELSE 'apply_028_repair_columns_indexes_pk'
  END AS chosen_action;

\echo '▶ 028 preflight complete (READ-ONLY)'
\echo 'Ops: if chosen_action=BLOCKED_CLEAN_DUPLICATES do NOT apply 028 until duplicate/NULL case_id rows are cleaned.'
