-- =============================================================================
-- preflight-migration-023.sql
-- Stage 15.2c — READ-ONLY production preflight for Migration 023
--
-- SELECT only. No CREATE / INSERT / UPDATE / DELETE / TEMP tables.
-- Does not mutate data. Does not apply Migration 023.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/preflight-migration-023.sql
--
-- Trusted owner rules (same as Migration 023 — migration re-validates independently):
--   map automatically only from:
--     - exactly one trial_offices.user_id
--     - exactly one active office_members.role = 'owner'
--     - existing UUID office belonging to that trusted owner
--   role=admin is NOT automatic ownership (trial creators are always 'owner' in code).
--   Ordinary members / users.office_id alone are NOT sufficient.
-- =============================================================================

\echo '═══ 023 PREFLIGHT: summary counts ═══'

SELECT
  (SELECT COUNT(DISTINCT office_id) FROM (
     SELECT office_id FROM trial_offices WHERE office_id LIKE 'trial_%'
     UNION
     SELECT office_id FROM office_members WHERE office_id LIKE 'trial_%'
     UNION
     SELECT office_id FROM users WHERE office_id LIKE 'trial_%'
     UNION
     SELECT office_id FROM onboarding_state WHERE office_id LIKE 'trial_%'
   ) u) AS distinct_trial_office_ids,
  (SELECT COUNT(*) FROM tasks WHERE office_id LIKE 'trial_%') AS tasks_with_trial_office_id,
  (SELECT COUNT(*) FROM tasks WHERE office_id IS NULL) AS null_tasks_left_for_022,
  (SELECT COUNT(*) FROM cases WHERE office_id = 'default') AS cases_with_default_office_id;

\echo '═══ 023 PREFLIGHT: per-legacy-id ownership classification ═══'

WITH trial_ids AS (
  SELECT DISTINCT office_id AS old_office_id FROM (
    SELECT office_id FROM trial_offices WHERE office_id LIKE 'trial_%'
    UNION ALL
    SELECT office_id FROM office_members WHERE office_id LIKE 'trial_%'
    UNION ALL
    SELECT office_id FROM users WHERE office_id LIKE 'trial_%'
    UNION ALL
    SELECT office_id FROM onboarding_state WHERE office_id LIKE 'trial_%'
  ) s
),
trial_owners AS (
  SELECT office_id,
         COUNT(DISTINCT user_id) AS n,
         MIN(user_id) AS user_id
  FROM trial_offices
  WHERE office_id LIKE 'trial_%'
  GROUP BY office_id
),
owner_members AS (
  SELECT office_id,
         COUNT(DISTINCT user_id) AS n,
         MIN(user_id) AS user_id
  FROM office_members
  WHERE office_id LIKE 'trial_%'
    AND status = 'active'
    AND role = 'owner'
  GROUP BY office_id
),
admin_members AS (
  SELECT office_id,
         COUNT(DISTINCT user_id) AS n,
         MIN(user_id) AS user_id
  FROM office_members
  WHERE office_id LIKE 'trial_%'
    AND status = 'active'
    AND role = 'admin'
  GROUP BY office_id
),
classified AS (
  SELECT
    t.old_office_id,
    CASE WHEN tro.n = 1 THEN tro.user_id ELSE NULL END AS trial_owner_user_id,
    CASE WHEN om.n = 1 THEN om.user_id ELSE NULL END AS owner_member_user_id,
    CASE WHEN am.n = 1 THEN am.user_id ELSE NULL END AS admin_member_user_id,
    tro.n AS trial_owner_count,
    om.n AS owner_member_count,
    am.n AS admin_member_count
  FROM trial_ids t
  LEFT JOIN trial_owners tro ON tro.office_id = t.old_office_id
  LEFT JOIN owner_members om ON om.office_id = t.old_office_id
  LEFT JOIN admin_members am ON am.office_id = t.old_office_id
),
with_choice AS (
  SELECT
    c.*,
    CASE
      WHEN c.trial_owner_count > 1 THEN NULL
      WHEN c.owner_member_count > 1 THEN NULL
      WHEN c.trial_owner_user_id IS NOT NULL
           AND c.owner_member_user_id IS NOT NULL
           AND c.trial_owner_user_id IS DISTINCT FROM c.owner_member_user_id THEN NULL
      WHEN c.trial_owner_user_id IS NOT NULL THEN c.trial_owner_user_id
      WHEN c.owner_member_user_id IS NOT NULL THEN c.owner_member_user_id
      ELSE NULL
    END AS chosen_owner,
    CASE
      WHEN c.trial_owner_count > 1 THEN 'conflict'
      WHEN c.owner_member_count > 1 THEN 'conflict'
      WHEN c.trial_owner_user_id IS NOT NULL
           AND c.owner_member_user_id IS NOT NULL
           AND c.trial_owner_user_id IS DISTINCT FROM c.owner_member_user_id
        THEN 'conflict'
      WHEN c.trial_owner_user_id IS NOT NULL THEN 'map_to_new_or_existing'
      WHEN c.owner_member_user_id IS NOT NULL THEN 'map_to_new_or_existing'
      ELSE 'unresolved'
    END AS chosen_action,
    CASE
      WHEN c.trial_owner_count > 1 THEN 'multiple trial_offices.user_id'
      WHEN c.owner_member_count > 1 THEN 'multiple active role=owner members'
      WHEN c.trial_owner_user_id IS NOT NULL
           AND c.owner_member_user_id IS NOT NULL
           AND c.trial_owner_user_id IS DISTINCT FROM c.owner_member_user_id
        THEN 'trial_offices.user_id disagrees with office_members.role=owner'
      WHEN c.trial_owner_user_id IS NULL AND c.owner_member_user_id IS NULL
        THEN 'no trial_offices.user_id and no active role=owner (ordinary member / users.office_id / admin alone are insufficient)'
      ELSE NULL
    END AS conflict_reason
  FROM classified c
)
SELECT
  w.old_office_id,
  w.trial_owner_user_id,
  w.owner_member_user_id,
  w.admin_member_user_id,
  (
    SELECT om.office_id
    FROM office_members om
    WHERE om.user_id = w.chosen_owner
      AND om.status = 'active'
      AND om.role = 'owner'
      AND om.office_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ORDER BY om.created_at ASC NULLS LAST
    LIMIT 1
  ) AS existing_uuid_office,
  w.chosen_owner,
  CASE
    WHEN w.chosen_owner IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM office_members om
           WHERE om.user_id = w.chosen_owner
             AND om.status = 'active'
             AND om.role = 'owner'
             AND om.office_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         )
      THEN 'map_to_new_or_existing'
    ELSE w.chosen_action
  END AS chosen_action,
  w.conflict_reason
FROM with_choice w
ORDER BY w.old_office_id;

\echo '═══ 023 PREFLIGHT: two legacy ids → one trusted owner ═══'

WITH ids AS (
  SELECT DISTINCT office_id AS old_office_id FROM (
    SELECT office_id FROM trial_offices WHERE office_id LIKE 'trial_%'
    UNION
    SELECT office_id FROM office_members WHERE office_id LIKE 'trial_%'
  ) s
),
resolved AS (
  SELECT
    i.old_office_id,
    CASE
      WHEN (SELECT COUNT(DISTINCT user_id) FROM trial_offices tr WHERE tr.office_id = i.old_office_id) > 1
        THEN NULL
      WHEN (SELECT COUNT(DISTINCT user_id) FROM office_members om
            WHERE om.office_id = i.old_office_id AND om.status = 'active' AND om.role = 'owner') > 1
        THEN NULL
      WHEN (SELECT COUNT(DISTINCT user_id) FROM trial_offices tr WHERE tr.office_id = i.old_office_id) = 1
           AND (SELECT COUNT(DISTINCT user_id) FROM office_members om
                WHERE om.office_id = i.old_office_id AND om.status = 'active' AND om.role = 'owner') = 1
           AND (SELECT MIN(user_id) FROM trial_offices tr WHERE tr.office_id = i.old_office_id)
               IS DISTINCT FROM
               (SELECT MIN(user_id) FROM office_members om
                WHERE om.office_id = i.old_office_id AND om.status = 'active' AND om.role = 'owner')
        THEN NULL
      WHEN (SELECT COUNT(DISTINCT user_id) FROM trial_offices tr WHERE tr.office_id = i.old_office_id) = 1
        THEN (SELECT MIN(user_id) FROM trial_offices tr WHERE tr.office_id = i.old_office_id)
      WHEN (SELECT COUNT(DISTINCT user_id) FROM office_members om
            WHERE om.office_id = i.old_office_id AND om.status = 'active' AND om.role = 'owner') = 1
        THEN (SELECT MIN(user_id) FROM office_members om
              WHERE om.office_id = i.old_office_id AND om.status = 'active' AND om.role = 'owner')
      ELSE NULL
    END AS owner_user_id
  FROM ids i
)
SELECT owner_user_id,
       COUNT(*) AS legacy_id_count,
       array_agg(old_office_id ORDER BY old_office_id) AS old_office_ids
FROM resolved
WHERE owner_user_id IS NOT NULL
GROUP BY owner_user_id
HAVING COUNT(*) > 1
ORDER BY owner_user_id;

\echo '═══ 023 PREFLIGHT: row counts that would be remapped (exact trial_* match) ═══'

SELECT 'cases' AS table_name, COUNT(*)::int AS trial_rows FROM cases WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'clients', COUNT(*)::int FROM clients WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'tasks', COUNT(*)::int FROM tasks WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'documents', COUNT(*)::int FROM documents WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'employees', COUNT(*)::int FROM employees WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'storage_files', COUNT(*)::int FROM storage_files WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'office_members', COUNT(*)::int FROM office_members WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'trial_offices', COUNT(*)::int FROM trial_offices WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'onboarding_state', COUNT(*)::int FROM onboarding_state WHERE office_id LIKE 'trial_%'
UNION ALL SELECT 'users', COUNT(*)::int FROM users WHERE office_id LIKE 'trial_%'
ORDER BY table_name;

\echo '═══ 023 PREFLIGHT: default office_id inventory (NOT auto-mapped) ═══'

SELECT 'cases' AS table_name, COUNT(*)::int AS default_rows FROM cases WHERE office_id = 'default'
UNION ALL SELECT 'clients', COUNT(*)::int FROM clients WHERE office_id = 'default'
UNION ALL SELECT 'tasks', COUNT(*)::int FROM tasks WHERE office_id = 'default'
UNION ALL SELECT 'onboarding_state', COUNT(*)::int FROM onboarding_state WHERE office_id = 'default'
UNION ALL SELECT 'system_events', COUNT(*)::int FROM system_events WHERE office_id = 'default'
UNION ALL SELECT 'office_members', COUNT(*)::int FROM office_members WHERE office_id = 'default'
ORDER BY table_name;

\echo '═══ 023 PREFLIGHT: complete ═══'
