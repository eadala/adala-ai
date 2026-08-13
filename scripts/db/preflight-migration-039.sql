-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 039 — READ-ONLY checks for AI Credits + Usage schema
--
-- This script reads catalogs/data and emits notices only. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Owned tables (3):
--   office_ai_credits (+ UNIQUE(office_id)), ai_credit_transactions,
--   ai_usage_logs (+ idx_ai_usage_office / idx_ai_usage_created /
--   idx_ai_usage_case partial)
--
-- office_id='default' is a deliberate business key, never UUID-validated,
-- never treated as a blocker. Its presence is reported informationally only.
--
-- Indexes are ALWAYS probed by name (even when the expected table is missing).
--
-- Blockers are collected before the decision ladder. Any blocker wins over
-- every safe repair, including missing tables.
--
-- Reason codes:
--   INCOMPATIBLE_TYPE, NULL_REQUIRED, INCOMPATIBLE_PK, INCOMPATIBLE_UNIQUE,
--   INCOMPATIBLE_INDEX, DUPLICATE_UNIQUE_KEY, TABLE_MISSING, PARTIAL_SCHEMA,
--   MISSING_INDEXES, MISSING_COLUMN_DEFAULTS, SET_NOT_NULL_PENDING.
--   AI_CREDITS_USAGE_SCHEMA_READY means ALREADY_CORRECT.
--
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 039 preflight: object presence'
SELECT
  to_regclass('public.office_ai_credits') IS NOT NULL AS office_ai_credits_present,
  to_regclass('public.ai_credit_transactions') IS NOT NULL AS ai_credit_transactions_present,
  to_regclass('public.ai_usage_logs') IS NOT NULL AS ai_usage_logs_present;

\echo '▶ 039 preflight: legacy default office_id row count (informational only, never a blocker)'
DO $probe$
DECLARE
  legacy_cnt BIGINT;
BEGIN
  IF to_regclass('public.office_ai_credits') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT COUNT(*) FROM public.office_ai_credits WHERE office_id = 'default'$q$ INTO legacy_cnt;
      RAISE NOTICE '039_preflight: legacy_default_office_id_present=% (office_ai_credits, informational, NOT a blocker)', legacy_cnt;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '039_preflight: legacy_default_office_id_present=<unavailable> (office_ai_credits)';
    END;
  ELSE
    RAISE NOTICE '039_preflight: legacy_default_office_id_present=<table_missing> (office_ai_credits)';
  END IF;
END
$probe$;

\echo '▶ 039 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY[
    'office_ai_credits','ai_credit_transactions','ai_usage_logs'
  ]::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_defaults TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_uniques TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_uniques TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0,0,0]::BIGINT[];
  null_required_count BIGINT := 0;
  duplicate_count BIGINT := 0;
  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'LOW';

  column_spec RECORD;
  tbl TEXT;
  tbl_idx INT;
  actual_relkind "char";
  actual_udt TEXT;
  actual_nullable TEXT;
  actual_default TEXT;
  normalized_default TEXT;
  row_count BIGINT;
  pk_cols TEXT[];

  has_uq BOOLEAN;
  wrong_uq BOOLEAN;
  bad_exact_uq BOOLEAN;
  near_miss_uq BOOLEAN;
  uq_cols TEXT[];

  idx_exists BOOLEAN;
  idx_valid BOOLEAN;
  idx_ready BOOLEAN;
  idx_partial BOOLEAN;
  idx_expr BOOLEAN;
  idx_cols TEXT[];
  idx_pred TEXT;

  empty_text TEXT := '<none>';
  rows_notice TEXT := '';
BEGIN
  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    tbl := owned_tables[tbl_idx];
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=tbl;
    IF NOT FOUND THEN
      missing_tables := array_append(missing_tables, tbl);
    ELSIF actual_relkind NOT IN ('r','p') THEN
      incompatible_objects := array_append(incompatible_objects, format('%s(relkind=%s)',tbl,actual_relkind));
    ELSE
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO row_count;
        estimated_rows[tbl_idx] := row_count;
      EXCEPTION WHEN undefined_table THEN
        missing_tables := array_append(missing_tables, tbl);
      END;
    END IF;
  END LOOP;

  -- Column type/default/not-null contract probe.
  -- office_id is intentionally excluded from any UUID-shape check.
  FOR column_spec IN
    SELECT * FROM (VALUES
      ('office_ai_credits','id','int4',TRUE,NULL,NULL),
      ('office_ai_credits','office_id','text',TRUE,'literal','default'),
      ('office_ai_credits','office_name','text',TRUE,NULL,NULL),
      ('office_ai_credits','balance','int4',TRUE,'literal','100'),
      ('office_ai_credits','monthly_allowance','int4',TRUE,'literal','100'),
      ('office_ai_credits','auto_renew','bool',TRUE,'literal','true'),
      ('office_ai_credits','renew_day','int4',TRUE,'literal','1'),
      ('office_ai_credits','last_renewed_at','timestamptz',FALSE,NULL,NULL),
      ('office_ai_credits','daily_limit','int4',FALSE,'literal','50'),
      ('office_ai_credits','daily_used','int4',FALSE,'literal','0'),
      ('office_ai_credits','monthly_limit','int4',FALSE,'literal','500'),
      ('office_ai_credits','monthly_used','int4',FALSE,'literal','0'),
      ('office_ai_credits','daily_reset_at','timestamptz',FALSE,NULL,NULL),
      ('office_ai_credits','created_at','timestamptz',TRUE,'now',NULL),
      ('office_ai_credits','updated_at','timestamptz',TRUE,'now',NULL),
      ('ai_credit_transactions','id','int4',TRUE,NULL,NULL),
      ('ai_credit_transactions','office_id','text',TRUE,'literal','default'),
      ('ai_credit_transactions','amount','int4',TRUE,NULL,NULL),
      ('ai_credit_transactions','type','text',TRUE,'literal','usage'),
      ('ai_credit_transactions','description','text',FALSE,NULL,NULL),
      ('ai_credit_transactions','model','text',FALSE,NULL,NULL),
      ('ai_credit_transactions','created_by','text',FALSE,NULL,NULL),
      ('ai_credit_transactions','created_at','timestamptz',TRUE,'now',NULL),
      ('ai_usage_logs','id','int4',TRUE,NULL,NULL),
      ('ai_usage_logs','office_id','text',TRUE,'literal','default'),
      ('ai_usage_logs','query_type','text',TRUE,'literal','custom'),
      ('ai_usage_logs','model_used','text',TRUE,NULL,NULL),
      ('ai_usage_logs','tier','text',TRUE,'literal','mid'),
      ('ai_usage_logs','cost_points','float4',TRUE,'literal','1'),
      ('ai_usage_logs','cached','bool',TRUE,'literal','false'),
      ('ai_usage_logs','response_ms','int4',FALSE,NULL,NULL),
      ('ai_usage_logs','prompt_length','int4',FALSE,NULL,NULL),
      ('ai_usage_logs','prompt_text','text',FALSE,NULL,NULL),
      ('ai_usage_logs','response_text','text',FALSE,NULL,NULL),
      ('ai_usage_logs','case_id','text',FALSE,NULL,NULL),
      ('ai_usage_logs','cost_sar','numeric',FALSE,'literal','0'),
      ('ai_usage_logs','token_count','int4',FALSE,'literal','0'),
      ('ai_usage_logs','policy_used','text',FALSE,NULL,NULL),
      ('ai_usage_logs','created_at','timestamptz',TRUE,'now',NULL)
    ) AS expected_column(
      table_name,column_name,expected_udt,required_not_null,default_kind,expected_default
    )
  LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=column_spec.table_name;
    IF NOT FOUND OR actual_relkind NOT IN ('r','p') THEN
      CONTINUE;
    END IF;

    SELECT c.udt_name,c.is_nullable,c.column_default
      INTO actual_udt,actual_nullable,actual_default
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=column_spec.table_name
      AND c.column_name=column_spec.column_name;
    IF NOT FOUND THEN
      missing_columns := array_append(missing_columns,format('%s.%s',column_spec.table_name,column_spec.column_name));
      CONTINUE;
    END IF;
    IF actual_udt IS DISTINCT FROM column_spec.expected_udt THEN
      incompatible_types := array_append(
        incompatible_types,
        format('%s.%s(expected=%s,actual=%s)',column_spec.table_name,column_spec.column_name,
          column_spec.expected_udt,coalesce(actual_udt,'<null>'))
      );
    END IF;
    IF column_spec.required_not_null THEN
      IF actual_nullable IS DISTINCT FROM 'NO' THEN
        missing_not_null := array_append(missing_not_null,format('%s.%s',column_spec.table_name,column_spec.column_name));
      END IF;
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL',
          column_spec.table_name,column_spec.column_name) INTO row_count;
        IF row_count > 0 THEN
          null_required_count := null_required_count + row_count;
          null_required_details := array_append(
            null_required_details,format('%s.%s=%s',column_spec.table_name,column_spec.column_name,row_count)
          );
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        NULL;
      END;
    END IF;

    IF column_spec.default_kind IS NULL THEN
      NULL;
    ELSIF column_spec.default_kind='literal' THEN
      normalized_default := regexp_replace(
        trim(both from split_part(coalesce(actual_default,''),'::',1)),'''','','g'
      );
      IF normalized_default IS DISTINCT FROM column_spec.expected_default THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected=%s,actual=%s)',column_spec.table_name,column_spec.column_name,
            column_spec.expected_default,coalesce(nullif(normalized_default,''),'<none>'))
        );
      END IF;
    ELSIF column_spec.default_kind='now' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%now()%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=now(),actual=%s)',column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    END IF;
  END LOOP;

  -- Duplicate office_id groups on office_ai_credits (would block the
  -- UNIQUE(office_id) arbiter; 'default' rows are counted like any other).
  IF to_regclass('public.office_ai_credits') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT office_id FROM public.office_ai_credits GROUP BY office_id HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('office_ai_credits(office_id)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;

  -- PK (id) probe for all owned tables.
  FOREACH tbl IN ARRAY owned_tables LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=tbl;
    IF NOT FOUND OR actual_relkind NOT IN ('r','p') THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=to_regclass(format('public.%I',tbl)) AND c.contype='p'
    ) THEN
      SELECT ARRAY(
        SELECT a.attname::TEXT
        FROM pg_constraint c
        CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum,ordinality)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum AND NOT a.attisdropped
        WHERE c.conrelid=to_regclass(format('public.%I',tbl)) AND c.contype='p'
        ORDER BY k.ordinality
      ) INTO pk_cols;
      IF pk_cols IS DISTINCT FROM ARRAY['id']::TEXT[] THEN
        incompatible_pks := array_append(incompatible_pks,
          format('%s(expected={id},actual=%s)',tbl,coalesce(pk_cols::TEXT,'<null>')));
      END IF;
    ELSE
      missing_pks := array_append(missing_pks,format('%s(id)',tbl));
    END IF;
  END LOOP;

  -- office_ai_credits UNIQUE(office_id): exact single-column only. Wider/
  -- wrong-order/partial/expression/invalid/not-ready near-miss shapes →
  -- INCOMPATIBLE_UNIQUE (never false READY).
  IF to_regclass('public.office_ai_credits') IS NOT NULL THEN
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='office_ai_credits';
    IF FOUND AND actual_relkind IN ('r','p') THEN
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.office_ai_credits'::regclass AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
          AND pg_get_constraintdef(c.oid) !~* ','
      ) OR EXISTS (
        SELECT 1 FROM pg_index x
        WHERE x.indrelid = 'public.office_ai_credits'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
          AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
               FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
               JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
              = ARRAY['office_id']::text[]
      ) INTO has_uq;

      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.office_ai_credits'::regclass AND c.contype = 'u'
          AND c.conname = 'office_ai_credits_office_id_key'
          AND (
            pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*office_id\s*\)'
            OR pg_get_constraintdef(c.oid) ~* ','
          )
      ) INTO wrong_uq;

      SELECT EXISTS (
        SELECT 1 FROM pg_index x
        WHERE x.indrelid = 'public.office_ai_credits'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
               FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
               JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
              = ARRAY['office_id']::text[]
          AND (
            x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
            OR x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
          )
      ) INTO bad_exact_uq;

      near_miss_uq := false;
      IF NOT has_uq THEN
        SELECT EXISTS (
          SELECT 1
          FROM pg_index x
          CROSS JOIN LATERAL (
            SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
            FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
          ) c
          WHERE x.indrelid = 'public.office_ai_credits'::regclass
            AND x.indisunique AND NOT x.indisprimary
            AND cardinality(c.cols) > 1
            AND ARRAY['office_id']::text[] <@ c.cols
        ) INTO near_miss_uq;
      END IF;

      IF wrong_uq OR bad_exact_uq OR near_miss_uq THEN
        incompatible_uniques := array_append(
          incompatible_uniques,
          format('office_ai_credits(expected=office_id,same_name_wrong=%s,bad_exact=%s,near_miss=%s)',
            coalesce(wrong_uq::TEXT,'f'), coalesce(bad_exact_uq::TEXT,'f'), coalesce(near_miss_uq::TEXT,'f'))
        );
      ELSIF NOT has_uq THEN
        missing_uniques := array_append(missing_uniques, 'office_ai_credits(office_id)');
      END IF;
    END IF;
  END IF;

  -- ai_usage_logs indexes: idx_ai_usage_office, idx_ai_usage_created
  -- (non-partial), idx_ai_usage_case (partial WHERE case_id IS NOT NULL).
  -- Always probed by name even if ai_usage_logs itself is missing.
  idx_exists := false; idx_valid := NULL; idx_ready := NULL; idx_partial := NULL; idx_expr := NULL; idx_cols := NULL;
  SELECT true, x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname='public' AND t.relname='ai_usage_logs' AND i.relname='idx_ai_usage_office'
  LIMIT 1;
  IF NOT FOUND THEN
    missing_indexes := array_append(missing_indexes, 'idx_ai_usage_office');
  ELSE
    IF idx_partial OR idx_expr OR idx_cols IS DISTINCT FROM ARRAY['office_id']::text[]
       OR idx_valid IS NOT TRUE OR idx_ready IS NOT TRUE THEN
      incompatible_indexes := array_append(incompatible_indexes,
        format('idx_ai_usage_office(cols=%s,partial=%s,expr=%s,valid=%s,ready=%s)',
          coalesce(idx_cols::TEXT,'<none>'), coalesce(idx_partial::TEXT,'<null>'),
          coalesce(idx_expr::TEXT,'<null>'), coalesce(idx_valid::TEXT,'<null>'), coalesce(idx_ready::TEXT,'<null>')));
    END IF;
  END IF;

  idx_exists := false; idx_valid := NULL; idx_ready := NULL; idx_partial := NULL; idx_expr := NULL; idx_cols := NULL;
  SELECT true, x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname='public' AND t.relname='ai_usage_logs' AND i.relname='idx_ai_usage_created'
  LIMIT 1;
  IF NOT FOUND THEN
    missing_indexes := array_append(missing_indexes, 'idx_ai_usage_created');
  ELSE
    IF idx_partial OR idx_expr OR idx_cols IS DISTINCT FROM ARRAY['created_at']::text[]
       OR idx_valid IS NOT TRUE OR idx_ready IS NOT TRUE THEN
      incompatible_indexes := array_append(incompatible_indexes,
        format('idx_ai_usage_created(cols=%s,partial=%s,expr=%s,valid=%s,ready=%s)',
          coalesce(idx_cols::TEXT,'<none>'), coalesce(idx_partial::TEXT,'<null>'),
          coalesce(idx_expr::TEXT,'<null>'), coalesce(idx_valid::TEXT,'<null>'), coalesce(idx_ready::TEXT,'<null>')));
    END IF;
  END IF;

  idx_exists := false; idx_valid := NULL; idx_ready := NULL; idx_partial := NULL; idx_expr := NULL; idx_cols := NULL; idx_pred := NULL;
  SELECT true, x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
         pg_get_expr(x.indpred, x.indrelid)
  INTO idx_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols, idx_pred
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname='public' AND t.relname='ai_usage_logs' AND i.relname='idx_ai_usage_case'
  LIMIT 1;
  IF NOT FOUND THEN
    missing_indexes := array_append(missing_indexes, 'idx_ai_usage_case');
  ELSE
    IF NOT idx_partial OR idx_expr
       OR idx_cols IS DISTINCT FROM ARRAY['case_id']::text[]
       OR COALESCE(idx_pred, '') !~* 'case_id[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
       OR idx_valid IS NOT TRUE OR idx_ready IS NOT TRUE THEN
      incompatible_indexes := array_append(incompatible_indexes,
        format('idx_ai_usage_case(cols=%s,partial=%s,pred=%s,valid=%s,ready=%s)',
          coalesce(idx_cols::TEXT,'<none>'), coalesce(idx_partial::TEXT,'<null>'),
          coalesce(idx_pred,'<none>'), coalesce(idx_valid::TEXT,'<null>'), coalesce(idx_ready::TEXT,'<null>')));
    END IF;
  END IF;

  -- Any blocker wins over every safe repair, including missing tables.
  IF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_uniques)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_UNIQUE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_INDEX'; lock_risk := 'HIGH';
  ELSIF duplicate_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'DUPLICATE_UNIQUE_KEY'; lock_risk := 'HIGH';
  ELSIF null_required_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0
     OR cardinality(missing_uniques)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_indexes)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_INDEXES'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_COLUMN_DEFAULTS'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'AI_CREDITS_USAGE_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx>1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '039_preflight: estimated_rows %',rows_notice;
  RAISE NOTICE '039_preflight: lock_risk=%',lock_risk;
  RAISE NOTICE '039_preflight: null_required_count=% details=%',null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''),empty_text);
  RAISE NOTICE '039_preflight: duplicate_unique_keys=%',
    coalesce(nullif(array_to_string(duplicate_details,','),''),empty_text);
  RAISE NOTICE '039_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''),empty_text);
  RAISE NOTICE '039_preflight: incompatible_pks=% incompatible_uniques=% incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes,','),''),empty_text);
  RAISE NOTICE '039_preflight: missing_tables=%',
    coalesce(nullif(array_to_string(missing_tables,','),''),empty_text);
  RAISE NOTICE '039_preflight: missing_columns=%',coalesce(nullif(array_to_string(missing_columns,','),''),empty_text);
  RAISE NOTICE '039_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''),empty_text);
  RAISE NOTICE '039_preflight: missing_pks=% missing_uniques=% missing_indexes=%',
    coalesce(nullif(array_to_string(missing_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_indexes,','),''),empty_text);
  RAISE NOTICE '039_preflight: chosen_action=% reason_code=%',action,reason_code;

  IF action='BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '039_preflight: BLOCK — do not apply Migration 039 until every blocker is resolved';
    RAISE EXCEPTION '039_preflight: chosen_action=% reason_code=%',action,reason_code;
  ELSIF action='SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '039_preflight: SAFE_AUTO_REPAIR — Migration 039 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '039_preflight: ALREADY_CORRECT — FULL READY (reason_code=AI_CREDITS_USAGE_SCHEMA_READY)';
  END IF;
END
$preflight$;
