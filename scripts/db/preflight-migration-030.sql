-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 030 — READ-ONLY office_messages.case_id TEXT alignment
-- (Stage 22)
--
-- Does not CREATE / ALTER / DROP durable objects.
-- Uses DO + temp table so absent-table paths stay safe under ON_ERROR_STOP=1.
-- Run before applying 030_office_messages_case_id_text.sql.
--
-- chosen_action values (must match migration 030):
--   ALREADY_CORRECT
--   SAFE_CONVERT_INTEGER_TO_TEXT
--   BLOCK_AND_MANUAL_REVIEW
--
-- Orphan legacy integer-text values alone do NOT invent repair.
-- Cross-office matches are reported for manual review (no remapping).
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 030 preflight: cases.id / office_messages.case_id types'
SELECT
  'cases.id' AS column_ref,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'cases' AND c.column_name = 'id'
UNION ALL
SELECT
  'office_messages.case_id',
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'office_messages'
  AND c.column_name = 'case_id';

\echo '▶ 030 preflight: row counts / distinct / match / orphan / cross-office'
DO $$
DECLARE
  table_present BOOLEAN;
  cases_present BOOLEAN;
  cases_id_udt TEXT := NULL;
  case_id_present BOOLEAN := false;
  case_id_udt TEXT := NULL;
  case_id_nullable TEXT := NULL;
  case_id_default TEXT := NULL;
  total_rows BIGINT := 0;
  null_case_id BIGINT := 0;
  nonnull_case_id BIGINT := 0;
  distinct_legacy BIGINT := 0;
  matched_to_cases BIGINT := 0;
  orphan_count BIGINT := 0;
  same_office_matches BIGINT := 0;
  cross_office_matches BIGINT := 0;
  estimated_rows BIGINT := 0;
  lock_risk TEXT := 'LOW';
  action TEXT;
  reason_code TEXT;
  idx_case_id_present BOOLEAN := false;
  fk_case_id_count INT := 0;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS preflight_030_report (
    office_messages_present BOOLEAN,
    cases_present BOOLEAN,
    cases_id_udt TEXT,
    case_id_present BOOLEAN,
    case_id_udt TEXT,
    case_id_nullable TEXT,
    case_id_default TEXT,
    total_rows BIGINT,
    null_case_id BIGINT,
    nonnull_case_id BIGINT,
    distinct_legacy_case_id BIGINT,
    matched_via_text BIGINT,
    orphan_count BIGINT,
    same_office_matches BIGINT,
    cross_office_matches BIGINT,
    fk_case_id_count INT,
    idx_messages_case_id_present BOOLEAN,
    estimated_rows BIGINT,
    lock_risk TEXT,
    chosen_action TEXT,
    reason_code TEXT,
    cross_office_review_note TEXT
  ) ON COMMIT PRESERVE ROWS;
  DELETE FROM preflight_030_report;

  table_present := to_regclass('public.office_messages') IS NOT NULL;
  cases_present := to_regclass('public.cases') IS NOT NULL;

  IF cases_present THEN
    SELECT c.udt_name INTO cases_id_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'cases' AND c.column_name = 'id'
    LIMIT 1;
  END IF;

  IF NOT table_present THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'OFFICE_MESSAGES_MISSING';
    INSERT INTO preflight_030_report VALUES (
      false, cases_present, cases_id_udt, false, NULL, NULL, NULL,
      0, 0, 0, 0, 0, 0, 0, 0, 0, false, 0, 'LOW', action, reason_code,
      'n/a'
    );
    RAISE NOTICE '030_preflight: chosen_action=% reason_code=%', action, reason_code;
    RETURN;
  END IF;

  SELECT
    true, c.udt_name, c.is_nullable, c.column_default
  INTO case_id_present, case_id_udt, case_id_nullable, case_id_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'office_messages'
    AND c.column_name = 'case_id'
  LIMIT 1;

  IF NOT FOUND THEN
    case_id_present := false;
    case_id_udt := NULL;
    case_id_nullable := NULL;
    case_id_default := NULL;
  END IF;

  SELECT COALESCE(c.reltuples, 0)::bigint INTO estimated_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'office_messages';

  lock_risk := CASE
    WHEN estimated_rows >= 100000 THEN 'HIGH'
    WHEN estimated_rows >= 10000 THEN 'MEDIUM'
    ELSE 'LOW'
  END;

  IF case_id_present THEN
    EXECUTE $q$
      SELECT
        COUNT(*)::bigint,
        COUNT(*) FILTER (WHERE case_id IS NULL)::bigint,
        COUNT(case_id)::bigint,
        COUNT(DISTINCT case_id)::bigint
      FROM office_messages
    $q$ INTO total_rows, null_case_id, nonnull_case_id, distinct_legacy;

    IF cases_present AND case_id_udt IN ('int4', 'text') THEN
      /* Compare via textual form of current column (int::text or text as-is). */
      EXECUTE $q$
        SELECT
          COUNT(*) FILTER (
            WHERE m.case_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM cases c WHERE c.id = m.case_id::text)
          )::bigint,
          COUNT(*) FILTER (
            WHERE m.case_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.id = m.case_id::text)
          )::bigint,
          COUNT(*) FILTER (
            WHERE m.case_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM cases c
                WHERE c.id = m.case_id::text AND c.office_id IS NOT DISTINCT FROM m.office_id
              )
          )::bigint,
          COUNT(*) FILTER (
            WHERE m.case_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM cases c
                WHERE c.id = m.case_id::text AND c.office_id IS DISTINCT FROM m.office_id
              )
          )::bigint
        FROM office_messages m
      $q$ INTO matched_to_cases, orphan_count, same_office_matches, cross_office_matches;
    END IF;
  END IF;

  SELECT COUNT(*)::int INTO fk_case_id_count
  FROM pg_constraint con
  JOIN pg_attribute a
    ON a.attrelid = con.conrelid
   AND a.attnum = ANY (con.conkey)
   AND NOT a.attisdropped
  WHERE con.conrelid = 'public.office_messages'::regclass
    AND con.contype = 'f'
    AND a.attname = 'case_id';

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'office_messages'
      AND indexname = 'idx_messages_case_id'
  ) INTO idx_case_id_present;

  IF NOT case_id_present THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'CASE_ID_COLUMN_MISSING';
  ELSIF cases_id_udt IS NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'CASES_ID_MISSING';
  ELSIF cases_id_udt IS DISTINCT FROM 'text' THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'CASES_ID_UNEXPECTED_TYPE';
  ELSIF case_id_udt = 'text' THEN
    action := 'ALREADY_CORRECT';
    reason_code := 'CASE_ID_ALREADY_TEXT';
  ELSIF case_id_udt = 'int4' THEN
    action := 'SAFE_CONVERT_INTEGER_TO_TEXT';
    reason_code := 'INTEGER_CASE_ID';
  ELSE
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'UNEXPECTED_CASE_ID_TYPE';
  END IF;

  INSERT INTO preflight_030_report VALUES (
    table_present,
    cases_present,
    cases_id_udt,
    case_id_present,
    case_id_udt,
    case_id_nullable,
    case_id_default,
    total_rows,
    null_case_id,
    nonnull_case_id,
    distinct_legacy,
    matched_to_cases,
    orphan_count,
    same_office_matches,
    cross_office_matches,
    fk_case_id_count,
    idx_case_id_present,
    estimated_rows,
    lock_risk,
    action,
    reason_code,
    CASE
      WHEN cross_office_matches > 0 THEN
        'CROSS_OFFICE_MATCHES_PRESENT — manual review; do NOT remap ownership from case_id alone'
      ELSE 'none'
    END
  );

  RAISE NOTICE
    '030_preflight: chosen_action=% reason_code=% case_id_udt=% orphan=% cross_office=% estimated_rows=% lock_risk=%',
    action, reason_code, case_id_udt, orphan_count, cross_office_matches, estimated_rows, lock_risk;

  IF cross_office_matches > 0 THEN
    RAISE NOTICE
      '030_preflight: WARNING cross_office_matches=% — surface for manual review; migration will NOT remap',
      cross_office_matches;
  END IF;
END $$;

SELECT * FROM preflight_030_report;

\echo '▶ 030 preflight: constraints involving office_messages.case_id'
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_attribute a
  ON a.attrelid = con.conrelid
 AND a.attnum = ANY (con.conkey)
 AND NOT a.attisdropped
WHERE con.conrelid = 'public.office_messages'::regclass
  AND a.attname = 'case_id';

\echo '▶ 030 preflight: indexes involving office_messages.case_id'
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'office_messages'
  AND indexdef ILIKE '%case_id%';

\echo '▶ 030 preflight complete (READ-ONLY durable schema)'
\echo 'Ops: if chosen_action = BLOCK_AND_MANUAL_REVIEW → do NOT apply 030 until resolved.'
\echo 'Ops: SAFE_CONVERT_INTEGER_TO_TEXT rewrites case_id (ACCESS EXCLUSIVE); check lock_risk.'
\echo 'Ops: orphans remain as textual values after convert — no invent UUID mapping; FK deferred.'
\echo 'Ops: cross_office_matches require manual review — never remap ownership from case_id alone.'
