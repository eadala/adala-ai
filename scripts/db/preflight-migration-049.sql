-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 049 — READ-ONLY checks for HR Performance schema
-- Owns: performance_evaluations, employee_incentives, hr_settings
-- Exact UNIQUE(key) on hr_settings for ON CONFLICT (key).
-- office_id required on performance_evaluations + employee_incentives (live DML).
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 049 preflight: object presence'
SELECT
  to_regclass('public.performance_evaluations') IS NOT NULL AS performance_evaluations_present,
  to_regclass('public.employee_incentives') IS NOT NULL AS employee_incentives_present,
  to_regclass('public.hr_settings') IS NOT NULL AS hr_settings_present;

\echo '▶ 049 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY['performance_evaluations','employee_incentives','hr_settings']::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_defaults TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_uniques TEXT[] := ARRAY[]::TEXT[];
  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_uniques TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];

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
  uq_rec RECORD;
  approved_unique_found BOOLEAN;
  hr_settings_incompatible BOOLEAN;
  rows_notice TEXT := '';
  empty_text TEXT := '<none>';
BEGIN
  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    tbl := owned_tables[tbl_idx];
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=tbl;
    IF NOT FOUND THEN
      missing_tables := array_append(missing_tables, tbl);
    ELSIF actual_relkind NOT IN ('r','p') THEN
      incompatible_objects := array_append(incompatible_objects, format('%s(relkind=%s)', tbl, actual_relkind));
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I', tbl) INTO row_count;
      estimated_rows[tbl_idx] := row_count;
    END IF;
  END LOOP;

  FOR column_spec IN
    SELECT * FROM (VALUES
      ('performance_evaluations','id','int4',TRUE,'serial_id',NULL),
      ('performance_evaluations','office_id','text',TRUE,NULL,NULL),
      ('performance_evaluations','employee_id','text',TRUE,NULL,NULL),
      ('performance_evaluations','period','text',TRUE,NULL,NULL),
      ('performance_evaluations','cases_closed','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','cases_delayed','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','tasks_completed','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','errors','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','on_time_days','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','late_days','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','absent_days','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','clients_handled','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','data_errors','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','ops_handled','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','incidents_resolved','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','system_errors','int4',TRUE,'int_literal','0'),
      ('performance_evaluations','role','text',TRUE,'literal','lawyer'),
      ('performance_evaluations','performance_score','numeric',TRUE,'numeric_literal','0'),
      ('performance_evaluations','notes','text',FALSE,NULL,NULL),
      ('performance_evaluations','evaluator_id','text',FALSE,NULL,NULL),
      ('performance_evaluations','created_at','timestamptz',TRUE,'now',NULL),
      ('employee_incentives','id','int4',TRUE,'serial_id',NULL),
      ('employee_incentives','office_id','text',TRUE,NULL,NULL),
      ('employee_incentives','employee_id','text',TRUE,NULL,NULL),
      ('employee_incentives','type','text',TRUE,'literal','bonus'),
      ('employee_incentives','amount','numeric',TRUE,'numeric_literal','0'),
      ('employee_incentives','reason','text',TRUE,'literal',''),
      ('employee_incentives','period','text',FALSE,NULL,NULL),
      ('employee_incentives','is_applied','bool',TRUE,'bool_literal','false'),
      ('employee_incentives','created_at','timestamptz',TRUE,'now',NULL),
      ('hr_settings','id','int4',TRUE,'serial_id',NULL),
      ('hr_settings','key','text',TRUE,NULL,NULL),
      ('hr_settings','val','text',TRUE,NULL,NULL)
    ) AS expected_column(table_name,column_name,expected_udt,required_not_null,default_kind,expected_default)
  LOOP
    IF to_regclass('public.' || column_spec.table_name) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT c.udt_name, c.is_nullable, c.column_default
      INTO actual_udt, actual_nullable, actual_default
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name=column_spec.table_name
      AND c.column_name=column_spec.column_name;

    IF actual_udt IS NULL THEN
      missing_columns := array_append(missing_columns,
        format('%s.%s', column_spec.table_name, column_spec.column_name));
      CONTINUE;
    END IF;

    IF actual_udt IS DISTINCT FROM column_spec.expected_udt THEN
      incompatible_types := array_append(incompatible_types,
        format('%s.%s(actual=%s,expected=%s)',
          column_spec.table_name, column_spec.column_name, actual_udt, column_spec.expected_udt));
      CONTINUE;
    END IF;

    IF column_spec.required_not_null AND actual_nullable = 'YES' THEN
      missing_not_null := array_append(missing_not_null,
        format('%s.%s', column_spec.table_name, column_spec.column_name));
      BEGIN
        EXECUTE format(
          $q$SELECT COUNT(*) FROM public.%I WHERE %I IS NULL$q$,
          column_spec.table_name, column_spec.column_name)
          INTO row_count;
        IF row_count > 0 THEN
          null_required_count := null_required_count + row_count;
          null_required_details := array_append(null_required_details,
            format('%s.%s=%s', column_spec.table_name, column_spec.column_name, row_count));
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        NULL;
      END;
    END IF;

    IF column_spec.default_kind IS NOT NULL THEN
      normalized_default := lower(coalesce(actual_default, ''));
      IF column_spec.default_kind = 'serial_id' THEN
        IF normalized_default !~ 'nextval' THEN
          missing_defaults := array_append(missing_defaults,
            format('%s.%s(serial)', column_spec.table_name, column_spec.column_name));
        END IF;
      ELSIF column_spec.default_kind = 'now' THEN
        IF normalized_default !~ 'now\(\)|current_timestamp' THEN
          missing_defaults := array_append(missing_defaults,
            format('%s.%s(now)', column_spec.table_name, column_spec.column_name));
        END IF;
      ELSIF column_spec.default_kind = 'literal' THEN
        IF position(quote_literal(column_spec.expected_default) IN coalesce(actual_default, '')) = 0
           AND position(column_spec.expected_default IN coalesce(actual_default, '')) = 0 THEN
          missing_defaults := array_append(missing_defaults,
            format('%s.%s(%s)', column_spec.table_name, column_spec.column_name, column_spec.expected_default));
        END IF;
      ELSIF column_spec.default_kind IN ('int_literal','numeric_literal') THEN
        IF normalized_default !~ ('(^|[^0-9])' || column_spec.expected_default || '([^0-9]|$)') THEN
          missing_defaults := array_append(missing_defaults,
            format('%s.%s(%s)', column_spec.table_name, column_spec.column_name, column_spec.expected_default));
        END IF;
      ELSIF column_spec.default_kind = 'bool_literal' THEN
        IF normalized_default IS DISTINCT FROM lower(column_spec.expected_default)
           AND normalized_default IS DISTINCT FROM lower(column_spec.expected_default) || '::boolean' THEN
          missing_defaults := array_append(missing_defaults,
            format('%s.%s(%s)', column_spec.table_name, column_spec.column_name, column_spec.expected_default));
        END IF;
      END IF;
    END IF;
  END LOOP;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    tbl := owned_tables[tbl_idx];
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    SELECT (
      SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality)
      FROM pg_constraint c
      CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum AND NOT a.attisdropped
      WHERE c.conrelid=to_regclass(format('public.%I', tbl)) AND c.contype='p'
    ) INTO pk_cols;
    IF pk_cols IS NOT NULL AND pk_cols IS DISTINCT FROM ARRAY['id']::TEXT[] THEN
      incompatible_pks := array_append(incompatible_pks, format('%s(actual=%s)', tbl, pk_cols::TEXT));
    ELSIF pk_cols IS NULL THEN
      BEGIN
        EXECUTE format(
          $q$SELECT count(*) FROM (
               SELECT id FROM public.%I WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
             ) d$q$, tbl)
          INTO row_count;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        row_count := 0;
      END;
      IF row_count > 0 THEN
        incompatible_pks := array_append(incompatible_pks,
          format('%s(duplicate_id_groups=%s)', tbl, row_count));
      ELSE
        missing_pks := array_append(missing_pks, format('%s(id)', tbl));
      END IF;
    END IF;
  END LOOP;

  IF to_regclass('public.hr_settings') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid='public.hr_settings'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (
          x.indpred IS NOT NULL
          OR x.indexprs IS NOT NULL
          OR x.indisvalid IS DISTINCT FROM TRUE
          OR x.indisready IS DISTINCT FROM TRUE
        )
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques, 'hr_settings(unique_index_invalid_or_partial_or_expression)');
    ELSE
      approved_unique_found := FALSE;
      hr_settings_incompatible := FALSE;
      FOR uq_rec IN
        SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) AS cols
        FROM pg_index x
        CROSS JOIN LATERAL unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
        WHERE x.indrelid='public.hr_settings'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND x.indpred IS NULL AND x.indexprs IS NULL
          AND x.indisvalid AND x.indisready
        GROUP BY x.indexrelid
      LOOP
        IF uq_rec.cols IS DISTINCT FROM ARRAY['key']::TEXT[] THEN
          hr_settings_incompatible := TRUE;
          incompatible_uniques := array_append(incompatible_uniques,
            format('hr_settings(expected={key},actual=%s)', uq_rec.cols::TEXT));
        ELSE
          approved_unique_found := TRUE;
        END IF;
      END LOOP;
      IF NOT approved_unique_found AND NOT hr_settings_incompatible THEN
        SELECT COUNT(*) INTO row_count
        FROM (
          SELECT key
          FROM hr_settings
          WHERE key IS NOT NULL
          GROUP BY key
          HAVING COUNT(*) > 1
        ) d;
        IF row_count > 0 THEN
          duplicate_count := row_count;
          duplicate_details := array_append(duplicate_details, format('hr_settings(key)=%s', row_count));
        ELSE
          missing_uniques := array_append(missing_uniques, 'hr_settings(key)');
        END IF;
      END IF;
    END IF;
  END IF;

  IF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_uniques)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_UNIQUE'; lock_risk := 'HIGH';
  ELSIF duplicate_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'DUPLICATE_UNIQUE_KEY'; lock_risk := 'HIGH';
  ELSIF null_required_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0 OR cardinality(missing_uniques)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_COLUMN_DEFAULTS'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'HR_PERFORMANCE_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx > 1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '049_preflight: estimated_rows %', rows_notice;
  RAISE NOTICE '049_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '049_preflight: null_required_count=% details=%', null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''), empty_text);
  RAISE NOTICE '049_preflight: incompatible_objects=% incompatible_types=% incompatible_pks=% incompatible_uniques=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''), empty_text);
  RAISE NOTICE '049_preflight: missing_tables=% missing_columns=% missing_defaults=% missing_not_null=% missing_pks=% missing_uniques=%',
    coalesce(nullif(array_to_string(missing_tables,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_columns,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_defaults,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''), empty_text);
  RAISE NOTICE '049_preflight: duplicate_unique_keys=% details=%',
    duplicate_count, coalesce(nullif(array_to_string(duplicate_details,','),''), empty_text);
  RAISE NOTICE '049_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE EXCEPTION '049_preflight: BLOCK_AND_MANUAL_REVIEW (reason_code=%)', reason_code;
  END IF;
END
$preflight$;
