-- =============================================================================
-- preflight-migration-024.sql
-- Stage 15.5 — READ-ONLY production preflight for Migration 024
--
-- SELECT only. No CREATE / INSERT / UPDATE / DELETE / TEMP tables.
-- Does not mutate data. Does not apply Migration 024.
--
-- APPLY ORDER (mandatory):
--   Migration 023 FIRST, then Migration 024.
--   Do not run Migration 024 while legacy trial_* cases remain.
--   Run this after 023 preflight (and preferably after 023 apply) so NULL tasks
--   linked to remapped cases can be classified as UUID-owned.
--
-- PRODUCTION GATE — Autopilot:
--   Autopilot UUID office writes must be deployed before production apply of 024.
--
-- Usage:
--   psql -U adalah -d adalah -v ON_ERROR_STOP=1 \
--     -f /opt/adala/scripts/db/preflight-migration-024.sql
-- =============================================================================

\echo '═══ 024 PREFLIGHT: summary ═══'

SELECT
  (SELECT COUNT(*)::int FROM tasks WHERE office_id IS NULL) AS null_tasks_total,
  (SELECT COUNT(*)::int FROM tasks WHERE office_id IS NOT NULL) AS tasks_with_office_id,
  (SELECT to_regclass('public.tasks_orphan_quarantine') IS NOT NULL) AS quarantine_table_exists;

\echo '═══ 024 PREFLIGHT: NULL tasks linked to UUID cases (would backfill via case) ═══'

SELECT COUNT(*)::int AS null_tasks_uuid_case
FROM tasks t
JOIN cases c ON t.case_id IS NOT NULL AND t.case_id = c.id::text
WHERE t.office_id IS NULL
  AND c.office_id IS NOT NULL
  AND c.office_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

\echo '═══ 024 PREFLIGHT: NULL tasks linked to trial_* or non-UUID cases ═══'

SELECT
  COUNT(*) FILTER (
    WHERE c.office_id IS NOT NULL AND c.office_id LIKE 'trial_%'
  )::int AS null_tasks_trial_case,
  COUNT(*) FILTER (
    WHERE c.office_id IS NOT NULL
      AND c.office_id NOT LIKE 'trial_%'
      AND c.office_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )::int AS null_tasks_other_non_uuid_case,
  COUNT(*) FILTER (
    WHERE c.office_id IS NULL
  )::int AS null_tasks_case_office_null,
  COUNT(*)::int AS null_tasks_with_case_row
FROM tasks t
JOIN cases c ON t.case_id IS NOT NULL AND t.case_id = c.id::text
WHERE t.office_id IS NULL;

\echo '═══ 024 PREFLIGHT: NULL tasks with case_id but no matching cases row ═══'

SELECT COUNT(*)::int AS null_tasks_orphan_case_id
FROM tasks t
WHERE t.office_id IS NULL
  AND t.case_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.id::text = t.case_id);

\echo '═══ 024 PREFLIGHT: NULL tasks linked to valid UUID branches (would backfill via branch) ═══'

SELECT COUNT(*)::int AS null_tasks_uuid_branch
FROM tasks t
JOIN office_branches b ON t.branch_id IS NOT NULL AND t.branch_id = b.id
WHERE t.office_id IS NULL
  AND b.office_id IS NOT NULL
  AND b.office_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND NOT EXISTS (
    SELECT 1
    FROM cases c
    WHERE t.case_id IS NOT NULL
      AND t.case_id = c.id::text
      AND c.office_id IS NOT NULL
      AND lower(c.office_id) <> lower(b.office_id)
  );

\echo '═══ 024 PREFLIGHT: case/branch ownership conflicts (NULL tasks) ═══'

SELECT COUNT(*)::int AS null_tasks_case_branch_conflict
FROM tasks t
JOIN office_branches b ON t.branch_id IS NOT NULL AND t.branch_id = b.id
JOIN cases c ON t.case_id IS NOT NULL AND t.case_id = c.id::text
WHERE t.office_id IS NULL
  AND c.office_id IS NOT NULL
  AND b.office_id IS NOT NULL
  AND lower(c.office_id) <> lower(b.office_id);

\echo '═══ 024 PREFLIGHT: tasks that would be quarantined (same rules as Migration 024) ═══'

SELECT
  CASE
    WHEN t.created_by = 'autopilot' AND t.case_id IS NULL
      THEN 'autopilot_missing_office_and_case'
    WHEN t.case_id IS NOT NULL
      THEN 'case_office_missing_or_non_uuid'
    WHEN t.branch_id IS NOT NULL
      THEN 'branch_office_missing_or_conflict'
    ELSE 'ambiguous_orphan_no_trusted_relation'
  END AS quarantine_reason,
  COUNT(*)::int AS task_count
FROM tasks t
WHERE t.office_id IS NULL
  AND NOT (
    /* Would be backfilled via UUID case */
    EXISTS (
      SELECT 1 FROM cases c
      WHERE t.case_id IS NOT NULL
        AND t.case_id = c.id::text
        AND c.office_id IS NOT NULL
        AND c.office_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  )
  AND NOT (
    /* Would be backfilled via UUID branch without case conflict */
    EXISTS (
      SELECT 1 FROM office_branches b
      WHERE t.branch_id IS NOT NULL
        AND t.branch_id = b.id
        AND b.office_id IS NOT NULL
        AND b.office_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND NOT EXISTS (
          SELECT 1 FROM cases c
          WHERE t.case_id IS NOT NULL
            AND t.case_id = c.id::text
            AND c.office_id IS NOT NULL
            AND lower(c.office_id) <> lower(b.office_id)
        )
    )
  )
GROUP BY 1
ORDER BY 1;

\echo '═══ 024 PREFLIGHT: quarantine totals (would_quarantine + existing table) ═══'

SELECT
  (
    SELECT COUNT(*)::int
    FROM tasks t
    WHERE t.office_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM cases c
        WHERE t.case_id IS NOT NULL
          AND t.case_id = c.id::text
          AND c.office_id IS NOT NULL
          AND c.office_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
      AND NOT EXISTS (
        SELECT 1 FROM office_branches b
        WHERE t.branch_id IS NOT NULL
          AND t.branch_id = b.id
          AND b.office_id IS NOT NULL
          AND b.office_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND NOT EXISTS (
            SELECT 1 FROM cases c
            WHERE t.case_id IS NOT NULL
              AND t.case_id = c.id::text
              AND c.office_id IS NOT NULL
              AND lower(c.office_id) <> lower(b.office_id)
          )
      )
  ) AS would_quarantine_count,
  (SELECT to_regclass('public.tasks_orphan_quarantine') IS NOT NULL) AS quarantine_table_exists;

\echo '═══ 024 PREFLIGHT: existing quarantine counts (read-only; safe if table absent) ═══'

SELECT
  (to_regclass('public.tasks_orphan_quarantine') IS NOT NULL) AS quarantine_table_exists;

-- NOTICE-only count when table already exists (no writes; no failure if absent)
DO $$
DECLARE
  n bigint := 0;
  by_reason text;
BEGIN
  IF to_regclass('public.tasks_orphan_quarantine') IS NULL THEN
    RAISE NOTICE '024_preflight: tasks_orphan_quarantine does not exist (existing_quarantine_rows=0)';
    RETURN;
  END IF;
  EXECUTE 'SELECT COUNT(*) FROM tasks_orphan_quarantine' INTO n;
  RAISE NOTICE '024_preflight: existing_quarantine_rows=%', n;
  EXECUTE $q$
    SELECT string_agg(quarantine_reason || '=' || cnt::text, ', ' ORDER BY quarantine_reason)
    FROM (
      SELECT quarantine_reason, COUNT(*)::int AS cnt
      FROM tasks_orphan_quarantine
      GROUP BY quarantine_reason
    ) s
  $q$ INTO by_reason;
  RAISE NOTICE '024_preflight: existing_quarantine_by_reason=%', COALESCE(by_reason, '(none)');
END $$;

\echo '═══ 024 PREFLIGHT: complete ═══'
\echo 'Decision: see Stage 15.5 thresholds (SAFE / MANUAL REVIEW / BLOCKED)'
