-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 050 — READ-ONLY checks for HR Enterprise schema
-- Owns: hr_roles, hr_memberships, hr_workflows, hr_audit_logs
--        + UNIQUE(office_id, name) / UNIQUE(office_id, user_id)
--        + idx_hrwf_office / idx_hral_office (created_at DESC)
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 050 preflight: object presence'
SELECT
  to_regclass('public.hr_roles') IS NOT NULL AS hr_roles_present,
  to_regclass('public.hr_memberships') IS NOT NULL AS hr_memberships_present,
  to_regclass('public.hr_workflows') IS NOT NULL AS hr_workflows_present,
  to_regclass('public.hr_audit_logs') IS NOT NULL AS hr_audit_logs_present;

\echo '▶ 050 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY['hr_roles','hr_memberships','hr_workflows','hr_audit_logs']::TEXT[];

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
  duplicate_details TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0,0,0,0]::BIGINT[];
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
  uq_table TEXT;
  uq_expected TEXT[];
  uq_label TEXT;

  idx_name TEXT;
  idx_expected_table TEXT;
  idx_expected_cols TEXT[];
  idx_expect_last_desc BOOLEAN;
  idx_table_oid OID;
  idx_unique BOOLEAN;
  idx_partial BOOLEAN;
  idx_expr BOOLEAN;
  idx_valid BOOLEAN;
  idx_ready BOOLEAN;
  idx_cols TEXT[];
  idx_opts INT[];
  desc_ok BOOLEAN;
  opt_i INT;

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
      ('hr_roles','id','uuid',TRUE),
      ('hr_roles','office_id','text',TRUE),
      ('hr_roles','name','text',TRUE),
      ('hr_roles','display_name','text',TRUE),
      ('hr_roles','scope','text',TRUE),
      ('hr_roles','hierarchy','int4',TRUE),
      ('hr_roles','permissions','jsonb',TRUE),
      ('hr_memberships','id','uuid',TRUE),
      ('hr_memberships','office_id','text',TRUE),
      ('hr_memberships','user_id','text',TRUE),
      ('hr_memberships','role_name','text',TRUE),
      ('hr_memberships','status','text',TRUE),
      ('hr_workflows','id','uuid',TRUE),
      ('hr_workflows','office_id','text',TRUE),
      ('hr_workflows','type','text',TRUE),
      ('hr_workflows','requester_id','text',TRUE),
      ('hr_workflows','payload','jsonb',TRUE),
      ('hr_workflows','status','text',TRUE),
      ('hr_workflows','priority','text',TRUE),
      ('hr_audit_logs','id','uuid',TRUE),
      ('hr_audit_logs','office_id','text',TRUE),
      ('hr_audit_logs','action','text',TRUE),
      ('hr_audit_logs','created_at','timestamptz',FALSE)
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

  FOR tbl_idx IN 1..2 LOOP
    IF tbl_idx = 1 THEN
      uq_table := 'hr_roles'; uq_expected := ARRAY['office_id','name']::TEXT[]; uq_label := 'hr_roles(office_id,name)';
    ELSE
      uq_table := 'hr_memberships'; uq_expected := ARRAY['office_id','user_id']::TEXT[]; uq_label := 'hr_memberships(office_id,user_id)';
    END IF;
    IF to_regclass('public.' || uq_table) IS NULL THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid=to_regclass(format('public.%I', uq_table))
        AND x.indisunique AND NOT x.indisprimary
        AND (x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
             OR x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE)
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques, format('%s(unique_index_invalid_or_partial_or_expression)', uq_table));
      CONTINUE;
    END IF;

    approved_unique_found := FALSE;
    unique_incompatible := FALSE;
    FOR uq_rec IN
      SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) AS cols
      FROM pg_index x
      CROSS JOIN LATERAL unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
      WHERE x.indrelid=to_regclass(format('public.%I', uq_table))
        AND x.indisunique AND NOT x.indisprimary
        AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisvalid AND x.indisready
      GROUP BY x.indexrelid
    LOOP
      IF uq_rec.cols IS DISTINCT FROM uq_expected THEN
        unique_incompatible := TRUE;
        incompatible_uniques := array_append(incompatible_uniques,
          format('%s(expected=%s,actual=%s)', uq_table, uq_expected::TEXT, uq_rec.cols::TEXT));
      ELSE
        approved_unique_found := TRUE;
      END IF;
    END LOOP;

    IF NOT approved_unique_found AND NOT unique_incompatible THEN
      IF uq_table = 'hr_roles' THEN
        SELECT COUNT(*) INTO row_count FROM (
          SELECT office_id, name FROM hr_roles
          WHERE office_id IS NOT NULL AND name IS NOT NULL
          GROUP BY office_id, name HAVING COUNT(*) > 1
        ) d;
      ELSE
        SELECT COUNT(*) INTO row_count FROM (
          SELECT office_id, user_id FROM hr_memberships
          WHERE office_id IS NOT NULL AND user_id IS NOT NULL
          GROUP BY office_id, user_id HAVING COUNT(*) > 1
        ) d;
      END IF;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('%s=%s', uq_label, row_count));
      ELSE
        missing_uniques := array_append(missing_uniques, uq_label);
      END IF;
    END IF;
  END LOOP;

  -- Indexes by global name
  FOR tbl_idx IN 1..2 LOOP
    IF tbl_idx = 1 THEN
      idx_name := 'idx_hrwf_office'; idx_expected_table := 'hr_workflows';
      idx_expected_cols := ARRAY['office_id','status']::TEXT[]; idx_expect_last_desc := FALSE;
    ELSE
      idx_name := 'idx_hral_office'; idx_expected_table := 'hr_audit_logs';
      idx_expected_cols := ARRAY['office_id','created_at']::TEXT[]; idx_expect_last_desc := TRUE;
    END IF;

    SELECT x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality))
    INTO idx_table_oid, idx_unique, idx_partial, idx_expr, idx_valid, idx_ready, idx_cols, idx_opts
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=idx_name;

    IF NOT FOUND THEN
      missing_indexes := array_append(missing_indexes, idx_name);
    ELSE
      desc_ok := true;
      IF idx_opts IS NULL OR cardinality(idx_opts) IS DISTINCT FROM cardinality(idx_expected_cols) THEN
        desc_ok := false;
      ELSE
        FOR opt_i IN 1 .. cardinality(idx_expected_cols) LOOP
          IF opt_i = cardinality(idx_expected_cols) AND idx_expect_last_desc THEN
            IF (idx_opts[opt_i] & 1) IS DISTINCT FROM 1 THEN desc_ok := false; END IF;
          ELSE
            IF (idx_opts[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
          END IF;
        END LOOP;
      END IF;
      IF idx_table_oid IS DISTINCT FROM to_regclass(format('public.%I', idx_expected_table))
         OR idx_unique IS DISTINCT FROM FALSE
         OR idx_partial IS DISTINCT FROM FALSE
         OR idx_expr IS DISTINCT FROM FALSE
         OR idx_valid IS DISTINCT FROM TRUE
         OR idx_ready IS DISTINCT FROM TRUE
         OR idx_cols IS DISTINCT FROM idx_expected_cols
         OR desc_ok IS NOT TRUE THEN
        incompatible_indexes := array_append(incompatible_indexes,
          format('%s(cols=%s opts=%s)', idx_name, coalesce(idx_cols::TEXT,'<null>'), coalesce(idx_opts::TEXT,'<null>')));
      END IF;
    END IF;
  END LOOP;

  IF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_uniques)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_UNIQUE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_INDEX'; lock_risk := 'HIGH';
  ELSIF duplicate_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'DUPLICATE_UNIQUE_KEY'; lock_risk := 'HIGH';
  ELSIF null_required_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0 OR cardinality(missing_uniques)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_indexes)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_INDEXES'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'HR_ENTERPRISE_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx > 1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '050_preflight: estimated_rows %', rows_notice;
  RAISE NOTICE '050_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '050_preflight: null_required_count=% details=%', null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''), empty_text);
  RAISE NOTICE '050_preflight: incompatible_objects=% incompatible_types=% incompatible_pks=% incompatible_uniques=% incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes,','),''), empty_text);
  RAISE NOTICE '050_preflight: missing_tables=% missing_columns=% missing_pks=% missing_uniques=% missing_indexes=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_tables,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_columns,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_indexes,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''), empty_text);
  RAISE NOTICE '050_preflight: duplicate_unique_keys=% details=%',
    duplicate_count, coalesce(nullif(array_to_string(duplicate_details,','),''), empty_text);
  RAISE NOTICE '050_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE EXCEPTION '050_preflight: BLOCK_AND_MANUAL_REVIEW (reason_code=%)', reason_code;
  END IF;
END
$preflight$;
