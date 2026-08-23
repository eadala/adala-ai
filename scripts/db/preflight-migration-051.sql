-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 051 — READ-ONLY checks for office_notification_settings
-- Owns: office_notification_settings + UNIQUE(office_id, event_type)
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 051 preflight: object presence'
SELECT to_regclass('public.office_notification_settings') IS NOT NULL AS office_notification_settings_present;

\echo '▶ 051 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY['office_notification_settings']::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_uniques TEXT[] := ARRAY[]::TEXT[];
  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_uniques TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0]::BIGINT[];
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
  row_count BIGINT;
  pk_cols TEXT[];
  uq_rec RECORD;
  approved_unique_found BOOLEAN;
  unique_incompatible BOOLEAN;

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
      ('office_notification_settings','id','uuid',TRUE),
      ('office_notification_settings','office_id','text',TRUE),
      ('office_notification_settings','event_type','text',TRUE),
      ('office_notification_settings','push_enabled','bool',TRUE),
      ('office_notification_settings','in_app_enabled','bool',TRUE),
      ('office_notification_settings','email_enabled','bool',TRUE),
      ('office_notification_settings','updated_at','timestamp',FALSE)
    ) AS expected_column(table_name,column_name,expected_udt,required_not_null)
  LOOP
    IF to_regclass('public.' || column_spec.table_name) IS NULL THEN CONTINUE; END IF;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, actual_nullable
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name=column_spec.table_name
      AND c.column_name=column_spec.column_name;
    IF actual_udt IS NULL THEN
      missing_columns := array_append(missing_columns, format('%s.%s', column_spec.table_name, column_spec.column_name));
      CONTINUE;
    END IF;
    IF actual_udt IS DISTINCT FROM column_spec.expected_udt THEN
      incompatible_types := array_append(incompatible_types,
        format('%s.%s(actual=%s,expected=%s)', column_spec.table_name, column_spec.column_name, actual_udt, column_spec.expected_udt));
      CONTINUE;
    END IF;
    IF column_spec.required_not_null AND actual_nullable = 'YES' THEN
      missing_not_null := array_append(missing_not_null, format('%s.%s', column_spec.table_name, column_spec.column_name));
      BEGIN
        EXECUTE format($q$SELECT COUNT(*) FROM public.%I WHERE %I IS NULL$q$, column_spec.table_name, column_spec.column_name)
          INTO row_count;
        IF row_count > 0 THEN
          null_required_count := null_required_count + row_count;
          null_required_details := array_append(null_required_details,
            format('%s.%s=%s', column_spec.table_name, column_spec.column_name, row_count));
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
      END;
    END IF;
  END LOOP;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    tbl := owned_tables[tbl_idx];
    IF to_regclass('public.' || tbl) IS NULL THEN CONTINUE; END IF;
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
             ) d$q$, tbl) INTO row_count;
      EXCEPTION WHEN undefined_table OR undefined_column THEN row_count := 0;
      END;
      IF row_count > 0 THEN
        incompatible_pks := array_append(incompatible_pks, format('%s(duplicate_id_groups=%s)', tbl, row_count));
      ELSE
        missing_pks := array_append(missing_pks, format('%s(id)', tbl));
      END IF;
    END IF;
  END LOOP;

  IF to_regclass('public.office_notification_settings') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid='public.office_notification_settings'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
             OR x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE)
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques,
        'office_notification_settings(unique_index_invalid_or_partial_or_expression)');
    ELSE
      approved_unique_found := FALSE;
      unique_incompatible := FALSE;
      FOR uq_rec IN
        SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) AS cols
        FROM pg_index x
        CROSS JOIN LATERAL unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
        WHERE x.indrelid='public.office_notification_settings'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND x.indpred IS NULL AND x.indexprs IS NULL
          AND x.indisvalid AND x.indisready
        GROUP BY x.indexrelid
      LOOP
        IF uq_rec.cols IS DISTINCT FROM ARRAY['office_id','event_type']::TEXT[] THEN
          unique_incompatible := TRUE;
          incompatible_uniques := array_append(incompatible_uniques,
            format('office_notification_settings(expected={office_id,event_type},actual=%s)', uq_rec.cols::TEXT));
        ELSE
          approved_unique_found := TRUE;
        END IF;
      END LOOP;

      IF NOT approved_unique_found AND NOT unique_incompatible THEN
        SELECT COUNT(*) INTO row_count FROM (
          SELECT office_id, event_type FROM office_notification_settings
          WHERE office_id IS NOT NULL AND event_type IS NOT NULL
          GROUP BY office_id, event_type HAVING COUNT(*) > 1
        ) d;
        IF row_count > 0 THEN
          duplicate_count := duplicate_count + row_count;
          duplicate_details := array_append(duplicate_details,
            format('office_notification_settings(office_id,event_type)=%s', row_count));
        ELSE
          missing_uniques := array_append(missing_uniques,
            'office_notification_settings(office_id,event_type)');
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
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'OFFICE_NOTIFICATION_SETTINGS_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx > 1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '051_preflight: estimated_rows %', rows_notice;
  RAISE NOTICE '051_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '051_preflight: null_required_count=% details=%', null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''), empty_text);
  RAISE NOTICE '051_preflight: incompatible_objects=% incompatible_types=% incompatible_pks=% incompatible_uniques=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''), empty_text);
  RAISE NOTICE '051_preflight: missing_tables=% missing_columns=% missing_pks=% missing_uniques=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_tables,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_columns,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''), empty_text);
  RAISE NOTICE '051_preflight: duplicate_unique_keys=% details=%',
    duplicate_count, coalesce(nullif(array_to_string(duplicate_details,','),''), empty_text);
  RAISE NOTICE '051_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE EXCEPTION '051_preflight: BLOCK_AND_MANUAL_REVIEW (reason_code=%)', reason_code;
  END IF;
END
$preflight$;
