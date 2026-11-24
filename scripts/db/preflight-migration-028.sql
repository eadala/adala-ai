-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 028 — READ-ONLY checks for case_autopilot_reports
--
-- Does not CREATE / ALTER / DROP durable objects.
-- Uses DO + EXECUTE so absent-table paths stay safe under ON_ERROR_STOP=1.
-- Run before applying 028_case_autopilot_reports_schema_authority.sql.
--
-- ON CONFLICT (case_id) arbiter rules (must match migration 028):
--   Accept ONLY:
--     - PRIMARY KEY on exactly (case_id), OR
--     - UNIQUE constraint on exactly (case_id), OR
--     - unique index that is ALL of: unique, valid, exactly one key column,
--       column is case_id, indpred IS NULL, indexprs IS NULL
--   Reject: partial UNIQUE, expression UNIQUE, multi-column unique, invalid indexes
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 028 preflight: table presence'
SELECT
  to_regclass('public.case_autopilot_reports') IS NOT NULL
    AS case_autopilot_reports_present;

\echo '▶ 028 preflight: case_autopilot_reports columns (if present)'
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'case_autopilot_reports'
ORDER BY ordinal_position;

\echo '▶ 028 preflight: column type inventory vs expected (report only; no rewrite)'
SELECT
  e.column_name,
  c.udt_name AS actual_udt,
  e.expected_udt,
  CASE
    WHEN c.udt_name IS NULL THEN 'missing_column'
    WHEN c.udt_name IS DISTINCT FROM e.expected_udt THEN 'differs_from_expected'
    ELSE 'ok'
  END AS status
FROM (
  VALUES
    ('case_id', 'text'),
    ('office_id', 'text'),
    ('health_score', 'int4'),
    ('grade', 'text'),
    ('risks', 'jsonb'),
    ('missing_data', 'jsonb'),
    ('next_steps', 'jsonb'),
    ('tasks_created', 'int4'),
    ('outcome_prediction', 'jsonb'),
    ('ai_summary', 'text'),
    ('run_at', 'timestamptz')
) AS e(column_name, expected_udt)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'case_autopilot_reports'
 AND c.column_name = e.column_name
WHERE to_regclass('public.case_autopilot_reports') IS NOT NULL
ORDER BY e.column_name;

\echo '▶ 028 preflight: types that would make Migration 028 SET DEFAULT fail'
SELECT column_name, udt_name, reason
FROM (
  SELECT c.column_name, c.udt_name,
    CASE
      WHEN c.column_name IN ('risks', 'missing_data', 'next_steps', 'outcome_prediction')
       AND c.udt_name NOT IN ('jsonb', 'json', 'text', 'varchar', 'bpchar')
      THEN 'SET DEFAULT jsonb literal will fail'
      WHEN c.column_name IN ('health_score', 'tasks_created')
       AND c.udt_name NOT IN ('int2', 'int4', 'int8', 'numeric', 'float4', 'float8')
      THEN 'SET DEFAULT 0 will fail'
      WHEN c.column_name IN ('grade', 'case_id', 'office_id', 'ai_summary')
       AND c.udt_name NOT IN ('text', 'varchar', 'bpchar', 'name', 'citext')
      THEN 'SET DEFAULT / TEXT Autopilot values may fail'
      WHEN c.column_name = 'run_at'
       AND c.udt_name NOT IN ('timestamptz', 'timestamp')
      THEN 'SET DEFAULT NOW() will fail'
      ELSE NULL
    END AS reason
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'case_autopilot_reports'
) t
WHERE reason IS NOT NULL
ORDER BY column_name;

\echo '▶ 028 preflight: ON CONFLICT (case_id) arbiter status'
DO $$
DECLARE
  has_constraint_arbiter BOOLEAN := false;
  has_index_arbiter BOOLEAN := false;
  unsafe_unique_indexes INT := 0;
BEGIN
  IF to_regclass('public.case_autopilot_reports') IS NULL THEN
    RAISE NOTICE '028_preflight: arbiter_status=table_absent';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.case_autopilot_reports'::regclass
      AND c.contype IN ('p', 'u')
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.conrelid
          AND a.attnum = c.conkey[1]
          AND NOT a.attisdropped
          AND a.attname = 'case_id'
      )
  ) INTO has_constraint_arbiter;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index x
    WHERE x.indrelid = 'public.case_autopilot_reports'::regclass
      AND x.indisunique
      AND x.indisvalid
      AND x.indpred IS NULL
      AND x.indexprs IS NULL
      AND x.indnkeyatts = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid
          AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped
          AND a.attname = 'case_id'
      )
  ) INTO has_index_arbiter;

  SELECT COUNT(*)::int INTO unsafe_unique_indexes
  FROM pg_index x
  WHERE x.indrelid = 'public.case_autopilot_reports'::regclass
    AND x.indisunique
    AND NOT (
      x.indisvalid
      AND x.indpred IS NULL
      AND x.indexprs IS NULL
      AND x.indnkeyatts = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid
          AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped
          AND a.attname = 'case_id'
      )
    );

  RAISE NOTICE '028_preflight: has_constraint_arbiter_pk_or_unique_case_id=%', has_constraint_arbiter;
  RAISE NOTICE '028_preflight: has_valid_unique_index_arbiter_case_id=%', has_index_arbiter;
  RAISE NOTICE '028_preflight: unsafe_unique_indexes_on_table=%', unsafe_unique_indexes;
  RAISE NOTICE '028_preflight: on_conflict_case_id_supported=%', (has_constraint_arbiter OR has_index_arbiter);
END $$;

\echo '▶ 028 preflight: ownership / null case_id / duplicates (safe if table absent)'
DO $$
DECLARE
  default_office_rows INT := 0;
  null_office_id INT := 0;
  non_uuid_office_id INT := 0;
  null_case_id INT := 0;
  total_rows INT := 0;
  dup_groups INT := 0;
BEGIN
  IF to_regclass('public.case_autopilot_reports') IS NULL THEN
    RAISE NOTICE '028_preflight: default_office_rows=0 null_office_id=0 non_uuid_office_id=0 null_case_id=0 total_rows=0 duplicate_case_id_groups=0';
    RETURN;
  END IF;

  EXECUTE $q$
    SELECT
      COUNT(*) FILTER (WHERE office_id = 'default')::int,
      COUNT(*) FILTER (WHERE office_id IS NULL)::int,
      COUNT(*) FILTER (
        WHERE office_id IS NOT NULL
          AND office_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )::int,
      COUNT(*) FILTER (WHERE case_id IS NULL)::int,
      COUNT(*)::int
    FROM case_autopilot_reports
  $q$ INTO default_office_rows, null_office_id, non_uuid_office_id, null_case_id, total_rows;

  EXECUTE $q$
    SELECT COUNT(*)::int FROM (
      SELECT case_id
      FROM case_autopilot_reports
      WHERE case_id IS NOT NULL
      GROUP BY case_id
      HAVING COUNT(*) > 1
    ) d
  $q$ INTO dup_groups;

  RAISE NOTICE '028_preflight: default_office_rows=% null_office_id=% non_uuid_office_id=% null_case_id=% total_rows=% duplicate_case_id_groups=%',
    default_office_rows, null_office_id, non_uuid_office_id, null_case_id, total_rows, dup_groups;
END $$;

\echo '▶ 028 preflight: duplicate case_id groups detail (empty if absent/none)'
DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  IF to_regclass('public.case_autopilot_reports') IS NULL THEN
    RAISE NOTICE '028_preflight: no duplicate groups (table absent)';
    RETURN;
  END IF;
  FOR r IN EXECUTE $q$
    SELECT case_id, COUNT(*)::int AS n
    FROM case_autopilot_reports
    WHERE case_id IS NOT NULL
    GROUP BY case_id
    HAVING COUNT(*) > 1
    ORDER BY n DESC
    LIMIT 50
  $q$
  LOOP
    n := n + 1;
    RAISE NOTICE '028_preflight: duplicate case_id=% n=%', r.case_id, r.n;
  END LOOP;
  IF n = 0 THEN
    RAISE NOTICE '028_preflight: no duplicate case_id groups';
  END IF;
END $$;

\echo '▶ 028 preflight: chosen_action'
DO $$
DECLARE
  present BOOLEAN;
  null_case_id INT := 0;
  dup_groups INT := 0;
  has_constraint_arbiter BOOLEAN := false;
  has_index_arbiter BOOLEAN := false;
  breaking_types INT := 0;
  action TEXT;
BEGIN
  present := to_regclass('public.case_autopilot_reports') IS NOT NULL;

  CREATE TEMP TABLE IF NOT EXISTS preflight_028_chosen_action (
    chosen_action TEXT NOT NULL
  ) ON COMMIT PRESERVE ROWS;
  DELETE FROM preflight_028_chosen_action;

  IF NOT present THEN
    action := 'apply_028_create_missing_table';
    INSERT INTO preflight_028_chosen_action VALUES (action);
    RAISE NOTICE '028_preflight: chosen_action=%', action;
    RETURN;
  END IF;

  EXECUTE 'SELECT COUNT(*)::int FROM case_autopilot_reports WHERE case_id IS NULL'
    INTO null_case_id;
  EXECUTE $q$
    SELECT COUNT(*)::int FROM (
      SELECT case_id FROM case_autopilot_reports
      WHERE case_id IS NOT NULL
      GROUP BY case_id HAVING COUNT(*) > 1
    ) d
  $q$ INTO dup_groups;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.case_autopilot_reports'::regclass
      AND c.contype IN ('p', 'u')
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.conrelid
          AND a.attnum = c.conkey[1]
          AND NOT a.attisdropped
          AND a.attname = 'case_id'
      )
  ) INTO has_constraint_arbiter;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index x
    WHERE x.indrelid = 'public.case_autopilot_reports'::regclass
      AND x.indisunique
      AND x.indisvalid
      AND x.indpred IS NULL
      AND x.indexprs IS NULL
      AND x.indnkeyatts = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid
          AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped
          AND a.attname = 'case_id'
      )
  ) INTO has_index_arbiter;

  SELECT COUNT(*)::int INTO breaking_types
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'case_autopilot_reports'
    AND (
      (c.column_name IN ('risks', 'missing_data', 'next_steps', 'outcome_prediction')
        AND c.udt_name NOT IN ('jsonb', 'json', 'text', 'varchar', 'bpchar'))
      OR (c.column_name IN ('health_score', 'tasks_created')
        AND c.udt_name NOT IN ('int2', 'int4', 'int8', 'numeric', 'float4', 'float8'))
      OR (c.column_name IN ('grade', 'case_id', 'office_id', 'ai_summary')
        AND c.udt_name NOT IN ('text', 'varchar', 'bpchar', 'name', 'citext'))
      OR (c.column_name = 'run_at'
        AND c.udt_name NOT IN ('timestamptz', 'timestamp'))
    );

  IF null_case_id > 0 OR dup_groups > 0 THEN
    action := 'BLOCKED_CLEAN_DUPLICATES';
  ELSIF breaking_types > 0 THEN
    action := 'BLOCKED_INCOMPATIBLE_COLUMN_TYPES';
  ELSIF has_constraint_arbiter OR has_index_arbiter THEN
    action := 'apply_028_repair_columns_indexes_pk';
  ELSE
    /* No usable arbiter yet (partial/expression/multi-col unique do NOT count).
       Apply will ADD PRIMARY KEY (case_id) if data is clean. */
    action := 'apply_028_repair_add_case_id_arbiter';
  END IF;

  INSERT INTO preflight_028_chosen_action VALUES (action);
  RAISE NOTICE '028_preflight: chosen_action=%', action;
END $$;

SELECT chosen_action FROM preflight_028_chosen_action;

\echo '▶ 028 preflight complete (READ-ONLY durable schema)'
\echo 'Ops: if chosen_action starts with BLOCKED_ do NOT apply 028 until resolved.'
\echo 'Ops: partial/expression/multi-column unique indexes are NOT valid ON CONFLICT (case_id) arbiters.'
