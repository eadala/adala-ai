-- READ-ONLY: JLWM non-UUID office_id inspection (Migration 034 blocker helper)
-- SELECT only. No INSERT/UPDATE/DELETE/DDL.
-- Same UUID regex as preflight-migration-034.sql.

\echo '▶ non-UUID office_id counts (jlwm_config / jlwm_world_states)'
WITH uuid_re AS (
  SELECT '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::text AS re
)
SELECT
  src.table_name,
  src.office_id,
  COUNT(*)::bigint AS row_count,
  CASE
    WHEN src.office_id = 'default' THEN 'default'
    WHEN src.office_id = 'platform' THEN 'platform'
    WHEN src.office_id LIKE 'trial_%' THEN 'trial_*'
    ELSE 'other'
  END AS value_class
FROM (
  SELECT 'jlwm_config'::text AS table_name, c.office_id
  FROM public.jlwm_config c, uuid_re
  WHERE c.office_id IS NOT NULL AND c.office_id !~ uuid_re.re
  UNION ALL
  SELECT 'jlwm_world_states', w.office_id
  FROM public.jlwm_world_states w, uuid_re
  WHERE w.office_id IS NOT NULL AND w.office_id !~ uuid_re.re
) src
GROUP BY src.table_name, src.office_id
ORDER BY src.table_name, src.office_id;

\echo '▶ spillover counts for those office_id values in other JLWM core tables'
WITH uuid_re AS (
  SELECT '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::text AS re
),
bad AS (
  SELECT DISTINCT office_id
  FROM public.jlwm_config, uuid_re
  WHERE office_id IS NOT NULL AND office_id !~ uuid_re.re
  UNION
  SELECT DISTINCT office_id
  FROM public.jlwm_world_states, uuid_re
  WHERE office_id IS NOT NULL AND office_id !~ uuid_re.re
)
SELECT t.table_name, b.office_id, t.cnt::bigint AS row_count
FROM bad b
CROSS JOIN LATERAL (
  VALUES
    ('jlwm_memory_nodes',     (SELECT COUNT(*) FROM public.jlwm_memory_nodes     n WHERE n.office_id = b.office_id)),
    ('jlwm_memory_edges',     (SELECT COUNT(*) FROM public.jlwm_memory_edges     e WHERE e.office_id = b.office_id)),
    ('jlwm_legal_patterns',   (SELECT COUNT(*) FROM public.jlwm_legal_patterns   p WHERE p.office_id = b.office_id)),
    ('jlwm_command_sessions', (SELECT COUNT(*) FROM public.jlwm_command_sessions s WHERE s.office_id = b.office_id)),
    ('jlwm_command_actions',  (SELECT COUNT(*) FROM public.jlwm_command_actions  a WHERE a.office_id = b.office_id)),
    ('jlwm_case_twins',       (SELECT COUNT(*) FROM public.jlwm_case_twins       c WHERE c.office_id = b.office_id)),
    ('jlwm_client_twins',     (SELECT COUNT(*) FROM public.jlwm_client_twins     c WHERE c.office_id = b.office_id)),
    ('jlwm_firm_twin',        (SELECT COUNT(*) FROM public.jlwm_firm_twin        f WHERE f.office_id = b.office_id)),
    ('jlwm_predictions',      (SELECT COUNT(*) FROM public.jlwm_predictions      p WHERE p.office_id = b.office_id)),
    ('jlwm_recommendations',  (SELECT COUNT(*) FROM public.jlwm_recommendations  r WHERE r.office_id = b.office_id)),
    ('jlwm_radar_alerts',     (SELECT COUNT(*) FROM public.jlwm_radar_alerts     a WHERE a.office_id = b.office_id)),
    ('jlwm_feedback',         (SELECT COUNT(*) FROM public.jlwm_feedback         f WHERE f.office_id = b.office_id))
) AS t(table_name, cnt)
WHERE t.cnt > 0
ORDER BY b.office_id, t.table_name;
