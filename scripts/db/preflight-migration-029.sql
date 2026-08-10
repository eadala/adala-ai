-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 029 — READ-ONLY FTS readiness for office_messages
-- (Stage 20.3)
--
-- Does not CREATE / ALTER / DROP durable objects.
-- Uses DO + temp table so absent-table paths stay safe under ON_ERROR_STOP=1.
-- Run before applying 029_office_messages_fts_readiness.sql.
--
-- chosen_action values (must match migration 029):
--   ALREADY_CORRECT
--   SAFE_AUTO_REPAIR_ADD_COLUMN
--   SAFE_AUTO_REPAIR_ADD_GIN
--   BLOCK_AND_MANUAL_REVIEW
--
-- ALREADY_CORRECT requires:
--   - search_vector tsvector, STORED generated ('s')
--   - expression = intended subject+body coalesce shape
--   - config exactly arabic|simple (not schema-qualified/custom)
--   - idx_messages_search valid ready non-partial GIN on search_vector
--
-- SAFE_AUTO_REPAIR_ADD_COLUMN only when:
--   - search_vector absent, subject/body present
--   - idx_messages_search absent (name free — conflicting shapes BLOCK)
--
-- Production lock/rewrite notes (report only — no DDL here):
--   - ADD GENERATED … STORED rewrites office_messages (ACCESS EXCLUSIVE)
--   - non-concurrent GIN build blocks writes for build duration
--   - CREATE INDEX CONCURRENTLY is NOT used inside migration transactions
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 029 preflight: office_messages presence'
SELECT
  to_regclass('public.office_messages') IS NOT NULL
    AS office_messages_present;

\echo '▶ 029 preflight: search_vector column inventory'
SELECT
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  a.attgenerated::text AS attgenerated,
  pg_get_expr(ad.adbin, ad.adrelid) AS generated_expression
FROM information_schema.columns c
JOIN pg_class cls
  ON cls.relname = c.table_name
 AND cls.relnamespace = 'public'::regnamespace
JOIN pg_attribute a
  ON a.attrelid = cls.oid
 AND a.attname = c.column_name
 AND NOT a.attisdropped
LEFT JOIN pg_attrdef ad
  ON ad.adrelid = a.attrelid
 AND ad.adnum = a.attnum
WHERE c.table_schema = 'public'
  AND c.table_name = 'office_messages'
  AND c.column_name = 'search_vector';

\echo '▶ 029 preflight: subject/body presence'
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_messages'
      AND column_name = 'subject'
  ) AS subject_present,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_messages'
      AND column_name = 'body'
  ) AS body_present;

\echo '▶ 029 preflight: idx_messages_search inventory'
SELECT
  i.relname AS index_name,
  am.amname AS index_am,
  x.indisvalid,
  x.indisready,
  x.indpred IS NOT NULL AS is_partial,
  pg_get_indexdef(i.oid) AS index_definition
FROM pg_class t
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_index x ON x.indrelid = t.oid
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_am am ON am.oid = i.relam
WHERE n.nspname = 'public'
  AND t.relname = 'office_messages'
  AND i.relname = 'idx_messages_search';

\echo '▶ 029 preflight: estimated row count / lock-risk indicator'
SELECT
  COALESCE(c.reltuples, 0)::bigint AS estimated_rows,
  CASE
    WHEN COALESCE(c.reltuples, 0) >= 100000 THEN 'HIGH'
    WHEN COALESCE(c.reltuples, 0) >= 10000 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS lock_risk,
  'ADD GENERATED STORED may rewrite table; non-concurrent GIN may block writes'
    AS lock_rewrite_note
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'office_messages';

\echo '▶ 029 preflight: classification + chosen_action'
DO $$
DECLARE
  table_present BOOLEAN;
  subject_present BOOLEAN := false;
  body_present BOOLEAN := false;
  vector_present BOOLEAN := false;
  vector_udt TEXT := NULL;
  att_generated TEXT := NULL;
  gen_expr TEXT := NULL;
  norm_expr TEXT := NULL;
  parsed_cfg TEXT := NULL;
  allowlisted BOOLEAN := false;
  expr_intended BOOLEAN := false;
  idx_present BOOLEAN := false;
  idx_am TEXT := NULL;
  idx_def TEXT := NULL;
  idx_valid BOOLEAN := NULL;
  idx_ready BOOLEAN := NULL;
  idx_on_search_vector BOOLEAN := false;
  idx_partial BOOLEAN := false;
  idx_ready_gin BOOLEAN := false;
  estimated_rows BIGINT := 0;
  lock_risk TEXT := 'LOW';
  action TEXT;
  reason_code TEXT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS preflight_029_report (
    office_messages_present BOOLEAN,
    search_vector_present BOOLEAN,
    search_vector_udt TEXT,
    attgenerated TEXT,
    generated_expression TEXT,
    parsed_config TEXT,
    allow_list_ok BOOLEAN,
    expression_intended BOOLEAN,
    idx_messages_search_present BOOLEAN,
    index_am TEXT,
    index_definition TEXT,
    indisvalid BOOLEAN,
    indisready BOOLEAN,
    index_partial BOOLEAN,
    estimated_rows BIGINT,
    lock_risk TEXT,
    chosen_action TEXT,
    reason_code TEXT
  ) ON COMMIT PRESERVE ROWS;
  DELETE FROM preflight_029_report;

  table_present := to_regclass('public.office_messages') IS NOT NULL;

  IF NOT table_present THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'OFFICE_MESSAGES_MISSING';
    INSERT INTO preflight_029_report VALUES (
      false, false, NULL, NULL, NULL, NULL, false, false,
      false, NULL, NULL, NULL, NULL, false, 0, 'LOW', action, reason_code
    );
    RAISE NOTICE '029_preflight: chosen_action=% reason_code=%', action, reason_code;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_messages'
      AND column_name = 'subject'
  ) INTO subject_present;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_messages'
      AND column_name = 'body'
  ) INTO body_present;

  SELECT COALESCE(c.reltuples, 0)::bigint INTO estimated_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'office_messages';

  lock_risk := CASE
    WHEN estimated_rows >= 100000 THEN 'HIGH'
    WHEN estimated_rows >= 10000 THEN 'MEDIUM'
    ELSE 'LOW'
  END;

  SELECT
    true,
    cols.udt_name,
    a.attgenerated::text,
    pg_get_expr(ad.adbin, ad.adrelid)
  INTO vector_present, vector_udt, att_generated, gen_expr
  FROM information_schema.columns cols
  JOIN pg_class cls
    ON cls.relname = cols.table_name
   AND cls.relnamespace = 'public'::regnamespace
  JOIN pg_attribute a
    ON a.attrelid = cls.oid
   AND a.attname = cols.column_name
   AND NOT a.attisdropped
  LEFT JOIN pg_attrdef ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
  WHERE cols.table_schema = 'public'
    AND cols.table_name = 'office_messages'
    AND cols.column_name = 'search_vector'
  LIMIT 1;

  IF NOT FOUND THEN
    vector_present := false;
    vector_udt := NULL;
    att_generated := NULL;
    gen_expr := NULL;
  END IF;

  IF gen_expr IS NOT NULL THEN
    parsed_cfg := (regexp_match(gen_expr, 'to_tsvector\(\s*''([^'']+)''', 'i'))[1];
    norm_expr := lower(regexp_replace(gen_expr, '::[a-z_]+', '', 'g'));
  END IF;
  allowlisted := parsed_cfg IN ('arabic', 'simple');
  expr_intended := allowlisted AND norm_expr IN (
    'to_tsvector(''arabic'', ((coalesce(subject, '''') || '' '') || coalesce(body, '''')))',
    'to_tsvector(''simple'', ((coalesce(subject, '''') || '' '') || coalesce(body, '''')))'
  );

  SELECT
    true,
    am.amname,
    pg_get_indexdef(i.oid),
    x.indisvalid,
    x.indisready,
    EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = x.indrelid
        AND a.attnum = x.indkey[0]
        AND NOT a.attisdropped
        AND a.attname = 'search_vector'
    ) AND x.indnkeyatts = 1 AND x.indexprs IS NULL,
    x.indpred IS NOT NULL
  INTO idx_present, idx_am, idx_def, idx_valid, idx_ready, idx_on_search_vector, idx_partial
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_am am ON am.oid = i.relam
  WHERE n.nspname = 'public'
    AND t.relname = 'office_messages'
    AND i.relname = 'idx_messages_search'
  LIMIT 1;

  IF NOT FOUND THEN
    idx_present := false;
    idx_am := NULL;
    idx_def := NULL;
    idx_valid := NULL;
    idx_ready := NULL;
    idx_on_search_vector := false;
    idx_partial := false;
  END IF;

  idx_ready_gin :=
    idx_present
    AND idx_am = 'gin'
    AND idx_on_search_vector
    AND NOT idx_partial
    AND idx_valid IS TRUE
    AND idx_ready IS TRUE;

  /* Classification priority matches Migration 029. */
  IF NOT vector_present THEN
    IF NOT (subject_present AND body_present) THEN
      action := 'BLOCK_AND_MANUAL_REVIEW';
      reason_code := 'SUBJECT_OR_BODY_MISSING';
    ELSIF idx_present AND NOT idx_ready_gin THEN
      action := 'BLOCK_AND_MANUAL_REVIEW';
      IF idx_am IS DISTINCT FROM 'gin' THEN
        reason_code := 'WRONG_INDEX_AM';
      ELSIF idx_partial THEN
        reason_code := 'PARTIAL_INDEX';
      ELSIF NOT idx_on_search_vector THEN
        reason_code := 'WRONG_INDEX_DEFINITION';
      ELSIF idx_valid IS NOT TRUE OR idx_ready IS NOT TRUE THEN
        reason_code := 'INDEX_NOT_VALID_OR_NOT_READY';
      ELSE
        reason_code := 'CONFLICTING_INDEX_NAME';
      END IF;
    ELSE
      action := 'SAFE_AUTO_REPAIR_ADD_COLUMN';
      reason_code := 'SEARCH_VECTOR_ABSENT';
    END IF;
  ELSIF vector_udt IS DISTINCT FROM 'tsvector' THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'WRONG_SEARCH_VECTOR_TYPE';
  ELSIF att_generated IS DISTINCT FROM 's' THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := CASE
      WHEN att_generated = 'v' THEN 'NON_STORED_GENERATED'
      ELSE 'NON_GENERATED_TSVECTOR'
    END;
  ELSIF parsed_cfg IS NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'UNPARSEABLE_GENERATED_EXPRESSION';
  ELSIF NOT allowlisted THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'UNSUPPORTED_FTS_CONFIG';
  ELSIF NOT expr_intended THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'WRONG_GENERATED_EXPRESSION';
  ELSIF NOT idx_present THEN
    action := 'SAFE_AUTO_REPAIR_ADD_GIN';
    reason_code := 'GIN_MISSING';
  ELSIF idx_am IS DISTINCT FROM 'gin' THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'WRONG_INDEX_AM';
  ELSIF idx_partial THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'PARTIAL_INDEX';
  ELSIF NOT idx_on_search_vector THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'WRONG_INDEX_DEFINITION';
  ELSIF idx_valid IS NOT TRUE OR idx_ready IS NOT TRUE THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INDEX_NOT_VALID_OR_NOT_READY';
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'FTS_READY';
  END IF;

  INSERT INTO preflight_029_report VALUES (
    table_present,
    vector_present,
    vector_udt,
    att_generated,
    gen_expr,
    parsed_cfg,
    allowlisted,
    expr_intended,
    idx_present,
    idx_am,
    idx_def,
    idx_valid,
    idx_ready,
    idx_partial,
    estimated_rows,
    lock_risk,
    action,
    reason_code
  );

  RAISE NOTICE '029_preflight: chosen_action=% reason_code=% parsed_config=% allow_list_ok=% expression_intended=% estimated_rows=% lock_risk=%',
    action, reason_code, parsed_cfg, allowlisted, expr_intended, estimated_rows, lock_risk;
END $$;

SELECT
  office_messages_present,
  search_vector_present,
  search_vector_udt,
  attgenerated,
  generated_expression,
  parsed_config,
  allow_list_ok,
  expression_intended,
  idx_messages_search_present,
  index_am,
  index_definition,
  indisvalid,
  indisready,
  index_partial,
  estimated_rows,
  lock_risk,
  chosen_action,
  reason_code
FROM preflight_029_report;

\echo '▶ 029 preflight complete (READ-ONLY durable schema)'
\echo 'Ops: if chosen_action = BLOCK_AND_MANUAL_REVIEW → do NOT apply 029 until resolved manually.'
\echo 'Ops: SAFE_AUTO_REPAIR_ADD_COLUMN may rewrite office_messages (ACCESS EXCLUSIVE).'
\echo 'Ops: SAFE_AUTO_REPAIR_ADD_GIN uses non-concurrent CREATE INDEX (may block writes).'
\echo 'Ops: if lock_risk = HIGH, schedule a maintenance window before apply.'
