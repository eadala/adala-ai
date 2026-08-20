-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 048 — READ-ONLY checks for HR Internal schema
-- Owns: hr_announcements, employee_requests, leave_balances
-- Exact UNIQUE(employee_id, leave_type, year) on leave_balances only.
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 048 preflight: object presence'
SELECT
  to_regclass('public.hr_announcements') IS NOT NULL AS hr_announcements_present,
  to_regclass('public.employee_requests') IS NOT NULL AS employee_requests_present,
  to_regclass('public.leave_balances') IS NOT NULL AS leave_balances_present;

\echo '▶ 048 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY['hr_announcements','employee_requests','leave_balances']::TEXT[];

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
  leave_balances_incompatible BOOLEAN;
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
      ('hr_announcements','id','int4',TRUE,'serial_id',NULL),
      ('hr_announcements','office_id','text',TRUE,'literal','default'),
      ('hr_announcements','title','text',TRUE,NULL,NULL),
      ('hr_announcements','content','text',TRUE,NULL,NULL),
      ('hr_announcements','priority','text',TRUE,'literal','normal'),
      ('hr_announcements','target_dept','text',FALSE,NULL,NULL),
      ('hr_announcements','author_name','text',FALSE,NULL,NULL),
      ('hr_announcements','author_id','text',FALSE,NULL,NULL),
      ('hr_announcements','expires_at','date',FALSE,NULL,NULL),
      ('hr_announcements','created_at','timestamptz',TRUE,'now',NULL),
      ('employee_requests','id','int4',TRUE,'serial_id',NULL),
      ('employee_requests','office_id','text',TRUE,'literal','default'),
      ('employee_requests','employee_id','text',TRUE,NULL,NULL),
      ('employee_requests','type','text',TRUE,'literal','document'),
      ('employee_requests','subject','text',TRUE,NULL,NULL),
      ('employee_requests','body','text',FALSE,NULL,NULL),
      ('employee_requests','status','text',TRUE,'literal','pending'),
      ('employee_requests','response','text',FALSE,NULL,NULL),
      ('employee_requests','resolved_by','text',FALSE,NULL,NULL),
      ('employee_requests','resolved_at','timestamptz',FALSE,NULL,NULL),
      ('employee_requests','created_at','timestamptz',TRUE,'now',NULL),
      ('leave_balances','id','int4',TRUE,'serial_id',NULL),
      ('leave_balances','office_id','text',TRUE,'literal','default'),
      ('leave_balances','employee_id','text',TRUE,NULL,NULL),
      ('leave_balances','leave_type','text',TRUE,'literal','annual'),
      ('leave_balances','year','int4',TRUE,'year_now',NULL),
      ('leave_balances','quota','int4',TRUE,'int_literal','21'),
      ('leave_balances','used','int4',TRUE,'int_literal','0')
    ) AS expected_column(table_name,column_name,expected_udt,required_not_null,default_kind,expected_default)
  LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=column_spec.table_name;
    IF NOT FOUND OR actual_relkind NOT IN ('r','p') THEN
      CONTINUE;
    END IF;

    SELECT c.udt_name, c.is_nullable, c.column_default
      INTO actual_udt, actual_nullable, actual_default
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=column_spec.table_name
      AND c.column_name=column_spec.column_name;
    IF NOT FOUND THEN
      missing_columns := array_append(missing_columns, format('%s.%s', column_spec.table_name, column_spec.column_name));
      CONTINUE;
    END IF;
    IF actual_udt IS DISTINCT FROM column_spec.expected_udt THEN
      incompatible_types := array_append(incompatible_types,
        format('%s.%s(expected=%s,actual=%s)', column_spec.table_name, column_spec.column_name, column_spec.expected_udt, coalesce(actual_udt,'<null>')));
    END IF;
    IF column_spec.required_not_null AND actual_nullable IS DISTINCT FROM 'NO' THEN
      missing_not_null := array_append(missing_not_null, format('%s.%s', column_spec.table_name, column_spec.column_name));
    END IF;
    IF column_spec.required_not_null THEN
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL', column_spec.table_name, column_spec.column_name) INTO row_count;
        IF row_count > 0 THEN
          null_required_count := null_required_count + row_count;
          null_required_details := array_append(null_required_details, format('%s.%s=%s', column_spec.table_name, column_spec.column_name, row_count));
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        NULL;
      END;
    END IF;

    IF column_spec.default_kind IS NULL THEN
      NULL;
    ELSIF column_spec.default_kind='literal' THEN
      normalized_default := regexp_replace(trim(both from split_part(coalesce(actual_default,''),'::',1)),'''','','g');
      IF normalized_default IS DISTINCT FROM column_spec.expected_default THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=%s,actual=%s)', column_spec.table_name, column_spec.column_name, column_spec.expected_default, coalesce(nullif(normalized_default,''),'<none>')));
      END IF;
    ELSIF column_spec.default_kind='now' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%now()%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=now(),actual=%s)', column_spec.table_name, column_spec.column_name, coalesce(actual_default,'<none>')));
      END IF;
    ELSIF column_spec.default_kind='int_literal' THEN
      normalized_default := regexp_replace(trim(both from split_part(coalesce(actual_default,''),'::',1)),'''','','g');
      IF normalized_default IS DISTINCT FROM column_spec.expected_default THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=%s,actual=%s)', column_spec.table_name, column_spec.column_name, column_spec.expected_default, coalesce(nullif(normalized_default,''),'<none>')));
      END IF;
    ELSIF column_spec.default_kind='serial_id' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%nextval(%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=nextval,actual=%s)', column_spec.table_name, column_spec.column_name, coalesce(actual_default,'<none>')));
      END IF;
    ELSIF column_spec.default_kind='year_now' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%date_part%' AND coalesce(actual_default,'') NOT ILIKE '%extract(year%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=extract_year_now,actual=%s)', column_spec.table_name, column_spec.column_name, coalesce(actual_default,'<none>')));
      END IF;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY owned_tables LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=tbl;
    IF NOT FOUND OR actual_relkind NOT IN ('r','p') THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=to_regclass(format('public.%I', tbl)) AND c.contype='p'
    ) THEN
      SELECT ARRAY(
        SELECT a.attname::TEXT
        FROM pg_constraint c
        CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum AND NOT a.attisdropped
        WHERE c.conrelid=to_regclass(format('public.%I', tbl)) AND c.contype='p'
        ORDER BY k.ordinality
      ) INTO pk_cols;
      IF pk_cols IS DISTINCT FROM ARRAY['id']::TEXT[] THEN
        incompatible_pks := array_append(incompatible_pks, format('%s(expected={id},actual=%s)', tbl, coalesce(pk_cols::TEXT,'<null>')));
      END IF;
    ELSE
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
        incompatible_pks := array_append(incompatible_pks, format('%s(duplicate_id_groups=%s)', tbl, row_count));
      ELSE
        missing_pks := array_append(missing_pks, format('%s(id)', tbl));
      END IF;
    END IF;
  END LOOP;

  IF to_regclass('public.leave_balances') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid='public.leave_balances'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (
          x.indpred IS NOT NULL
          OR x.indexprs IS NOT NULL
          OR x.indisvalid IS DISTINCT FROM TRUE
          OR x.indisready IS DISTINCT FROM TRUE
        )
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques, 'leave_balances(unique_index_invalid_or_partial_or_expression)');
    ELSE
      approved_unique_found := FALSE;
      leave_balances_incompatible := FALSE;
      FOR uq_rec IN
        SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) AS cols
        FROM pg_index x
        CROSS JOIN LATERAL unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
        WHERE x.indrelid='public.leave_balances'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND x.indpred IS NULL AND x.indexprs IS NULL
          AND x.indisvalid AND x.indisready
        GROUP BY x.indexrelid
      LOOP
        IF uq_rec.cols IS DISTINCT FROM ARRAY['employee_id','leave_type','year']::TEXT[] THEN
          leave_balances_incompatible := TRUE;
          incompatible_uniques := array_append(incompatible_uniques,
            format('leave_balances(expected={employee_id,leave_type,year},actual=%s)', uq_rec.cols::TEXT));
        ELSE
          approved_unique_found := TRUE;
        END IF;
      END LOOP;
      IF NOT approved_unique_found AND NOT leave_balances_incompatible THEN
        SELECT COUNT(*) INTO row_count
        FROM (
          SELECT employee_id, leave_type, year
          FROM leave_balances
          GROUP BY employee_id, leave_type, year
          HAVING COUNT(*) > 1
        ) d;
        IF row_count > 0 THEN
          duplicate_count := row_count;
          duplicate_details := array_append(duplicate_details, format('leave_balances(employee_id,leave_type,year)=%s', row_count));
        ELSE
          missing_uniques := array_append(missing_uniques, 'leave_balances(employee_id,leave_type,year)');
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
    action := 'ALREADY_CORRECT'; reason_code := 'HR_INTERNAL_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx > 1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '048_preflight: estimated_rows %', rows_notice;
  RAISE NOTICE '048_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '048_preflight: null_required_count=% details=%', null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''), empty_text);
  RAISE NOTICE '048_preflight: incompatible_objects=% incompatible_types=% incompatible_pks=% incompatible_uniques=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''), empty_text);
  RAISE NOTICE '048_preflight: duplicate_unique_keys=%',
    coalesce(nullif(array_to_string(duplicate_details,','),''), empty_text);
  RAISE NOTICE '048_preflight: missing_tables=% missing_columns=%', 
    coalesce(nullif(array_to_string(missing_tables,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_columns,','),''), empty_text);
  RAISE NOTICE '048_preflight: missing_defaults=% missing_not_null=% missing_pks=% missing_uniques=%',
    coalesce(nullif(array_to_string(missing_defaults,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''), empty_text);
  RAISE NOTICE '048_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action='BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '048_preflight: BLOCK — do not apply Migration 048 until every blocker is resolved';
    RAISE EXCEPTION '048_preflight: chosen_action=% reason_code=%', action, reason_code;
  ELSIF action='SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '048_preflight: SAFE_AUTO_REPAIR — Migration 048 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '048_preflight: ALREADY_CORRECT — FULL READY (reason_code=HR_INTERNAL_SCHEMA_READY)';
  END IF;
END
$preflight$;
