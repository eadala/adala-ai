-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 035 — READ-ONLY checks for JLWM Satellites schema
--
-- This script only reads catalogs/data and emits notices. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Owned tables (6):
--   jlwm_future_paths, jlwm_simulations, jlwm_litigation_intel,
--   jlwm_accuracy_records, jlwm_executive_reports, jlwm_coo_actions
--
-- Strict decision ladder:
--   1. Inspect every present 035-owned object (all 6 tables).
--   2. Collect blockers across all present objects.
--   3. Any blocker wins over every safe repair, including missing tables.
--   4. With no blockers, report SAFE_AUTO_REPAIR for any contract gap;
--      otherwise report ALREADY_CORRECT only when fully ready.
--
-- Taxonomy:
--   BLOCK_AND_MANUAL_REVIEW (RAISE EXCEPTION):
--     INCOMPATIBLE_TYPE   — wrong relkind or column udt
--     INCOMPATIBLE_PK     — PK present but not solely (id)
--     INCOMPATIBLE_INDEX  — same-name index wrong shape (table/cols/unique/
--                           partial/expression/valid/ready/DESC bits)
--     NULL_OFFICE_ID      — office_id IS NULL on present rows
--     NULL_REQUIRED       — Runtime NOT NULL column has NULL rows
--     NON_UUID_OFFICE_ID  — office_id text present but not UUID-shaped
--   SAFE_AUTO_REPAIR:
--     TABLE_MISSING           — one or more owned tables absent
--     PARTIAL_SCHEMA          — missing columns / PKs / indexes
--     MISSING_COLUMN_DEFAULTS — expected defaults absent/wrong
--     SET_NOT_NULL_PENDING    — column nullable but Runtime requires NOT NULL
--   ALREADY_CORRECT:
--     JLWM_SATELLITES_SCHEMA_READY — full 6-table contract matches
--
-- Safe when ALL 6 tables are absent (TABLE_MISSING → SAFE_AUTO_REPAIR).
-- No UNIQUE arbiters, no FK, no partial unique indexes in this contract.
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 035 preflight: object presence'
SELECT
  to_regclass('public.jlwm_future_paths') IS NOT NULL AS jlwm_future_paths_present,
  to_regclass('public.jlwm_simulations') IS NOT NULL AS jlwm_simulations_present,
  to_regclass('public.jlwm_litigation_intel') IS NOT NULL AS jlwm_litigation_intel_present,
  to_regclass('public.jlwm_accuracy_records') IS NOT NULL AS jlwm_accuracy_records_present,
  to_regclass('public.jlwm_executive_reports') IS NOT NULL AS jlwm_executive_reports_present,
  to_regclass('public.jlwm_coo_actions') IS NOT NULL AS jlwm_coo_actions_present;

\echo '▶ 035 preflight: full contract and decision'
DO $preflight$
DECLARE
  uuid_re CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  owned_tables CONSTANT TEXT[] := ARRAY[
    'jlwm_future_paths','jlwm_simulations','jlwm_litigation_intel',
    'jlwm_accuracy_records','jlwm_executive_reports','jlwm_coo_actions'
  ]::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_defaults TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];

  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  null_office_details TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  non_uuid_details TEXT[] := ARRAY[]::TEXT[];

  table_present BOOLEAN[] := ARRAY[
    false,false,false,false,false,false
  ]::BOOLEAN[];
  estimated_rows BIGINT[] := ARRAY[
    0,0,0,0,0,0
  ]::BIGINT[];

  null_office_count BIGINT := 0;
  null_required_count BIGINT := 0;
  non_uuid_count BIGINT := 0;

  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'LOW';

  column_spec RECORD;
  index_spec RECORD;
  tbl TEXT;
  tbl_idx INT;
  actual_relkind "char";
  actual_udt TEXT;
  actual_nullable TEXT;
  actual_default TEXT;
  normalized_default TEXT;
  row_count BIGINT;
  pk_exists BOOLEAN;
  pk_cols TEXT[];
  probe_safe BOOLEAN;

  index_oid OID;
  index_relkind "char";
  index_table TEXT;
  index_unique BOOLEAN;
  index_partial BOOLEAN;
  index_expression BOOLEAN;
  index_valid BOOLEAN;
  index_ready BOOLEAN;
  index_cols TEXT[];
  index_opts INT[];
  index_has_desc BOOLEAN;
  last_has_desc BOOLEAN;
  opts_i INT;

  empty_text TEXT := '<none>';
  rows_notice TEXT := '';
BEGIN
  /* ── 1) Presence, relkind, estimated rows ─────────────────────────────── */
  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    tbl := owned_tables[tbl_idx];
    actual_relkind := NULL;
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl;

    IF NOT FOUND THEN
      missing_tables := array_append(missing_tables, tbl);
      table_present[tbl_idx] := false;
      estimated_rows[tbl_idx] := 0;
    ELSIF actual_relkind NOT IN ('r', 'p') THEN
      table_present[tbl_idx] := false;
      incompatible_objects := array_append(
        incompatible_objects,
        format('%s(relkind=%s)', tbl, actual_relkind)
      );
    ELSE
      table_present[tbl_idx] := true;
      EXECUTE format('SELECT count(*) FROM public.%I', tbl) INTO row_count;
      estimated_rows[tbl_idx] := row_count;
    END IF;
  END LOOP;

  /* ── 2) Column contract (types / NOT NULL / defaults) ──────────────────── */
  FOR column_spec IN
    SELECT *
    FROM (VALUES
      -- jlwm_future_paths
      ('jlwm_future_paths','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_future_paths','office_id','text',TRUE,NULL,NULL),
      ('jlwm_future_paths','subject_type','text',TRUE,NULL,NULL),
      ('jlwm_future_paths','subject_id','text',FALSE,NULL,NULL),
      ('jlwm_future_paths','optimistic','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_future_paths','realistic','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_future_paths','pessimistic','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_future_paths','model_used','text',FALSE,NULL,NULL),
      ('jlwm_future_paths','expires_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_future_paths','created_at','timestamptz',TRUE,'now',NULL),
      -- jlwm_simulations
      ('jlwm_simulations','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_simulations','office_id','text',TRUE,NULL,NULL),
      ('jlwm_simulations','case_id','text',TRUE,NULL,NULL),
      ('jlwm_simulations','scenario_type','text',TRUE,NULL,NULL),
      ('jlwm_simulations','scenario_params','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_simulations','outcomes','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_simulations','recommended_outcome','text',FALSE,NULL,NULL),
      ('jlwm_simulations','model_used','text',FALSE,NULL,NULL),
      ('jlwm_simulations','created_at','timestamptz',TRUE,'now',NULL),
      -- jlwm_litigation_intel
      ('jlwm_litigation_intel','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_litigation_intel','office_id','text',TRUE,NULL,NULL),
      ('jlwm_litigation_intel','case_id','text',TRUE,NULL,NULL),
      ('jlwm_litigation_intel','strengths','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_litigation_intel','weaknesses','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_litigation_intel','missing_evidence','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_litigation_intel','procedural_risks','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_litigation_intel','recommended_actions','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_litigation_intel','overall_score','float8',TRUE,'literal','0.5'),
      ('jlwm_litigation_intel','confidence','float8',TRUE,'literal','0.5'),
      ('jlwm_litigation_intel','model_used','text',FALSE,NULL,NULL),
      ('jlwm_litigation_intel','expires_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_litigation_intel','created_at','timestamptz',TRUE,'now',NULL),
      -- jlwm_accuracy_records
      ('jlwm_accuracy_records','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_accuracy_records','office_id','text',TRUE,NULL,NULL),
      ('jlwm_accuracy_records','prediction_id','text',FALSE,NULL,NULL),
      ('jlwm_accuracy_records','case_id','text',TRUE,NULL,NULL),
      ('jlwm_accuracy_records','prediction_type','text',TRUE,NULL,NULL),
      ('jlwm_accuracy_records','predicted_value','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_accuracy_records','actual_value','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_accuracy_records','accuracy_score','float8',FALSE,NULL,NULL),
      ('jlwm_accuracy_records','deviation','float8',FALSE,NULL,NULL),
      ('jlwm_accuracy_records','notes','text',FALSE,NULL,NULL),
      ('jlwm_accuracy_records','recorded_by','text',FALSE,NULL,NULL),
      ('jlwm_accuracy_records','recorded_at','timestamptz',TRUE,'now',NULL),
      -- jlwm_executive_reports
      ('jlwm_executive_reports','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_executive_reports','office_id','text',TRUE,NULL,NULL),
      ('jlwm_executive_reports','report_type','text',TRUE,'literal','weekly'),
      ('jlwm_executive_reports','period_start','timestamptz',TRUE,NULL,NULL),
      ('jlwm_executive_reports','period_end','timestamptz',TRUE,NULL,NULL),
      ('jlwm_executive_reports','executive_summary','text',FALSE,NULL,NULL),
      ('jlwm_executive_reports','kpis','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_executive_reports','revenue_forecast','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_executive_reports','risk_concentration','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_executive_reports','lawyer_performance','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_executive_reports','client_risk','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_executive_reports','opportunities','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_executive_reports','alerts','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_executive_reports','generated_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_executive_reports','model_used','text',FALSE,NULL,NULL),
      ('jlwm_executive_reports','generation_ms','int4',FALSE,NULL,NULL),
      -- jlwm_coo_actions
      ('jlwm_coo_actions','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_coo_actions','office_id','text',TRUE,NULL,NULL),
      ('jlwm_coo_actions','action_type','text',TRUE,NULL,NULL),
      ('jlwm_coo_actions','title','text',TRUE,NULL,NULL),
      ('jlwm_coo_actions','description','text',TRUE,NULL,NULL),
      ('jlwm_coo_actions','priority','text',TRUE,'literal','medium'),
      ('jlwm_coo_actions','status','text',TRUE,'literal','pending_approval'),
      ('jlwm_coo_actions','target_ref','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_coo_actions','suggested_action','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_coo_actions','ai_reasoning','text',FALSE,NULL,NULL),
      ('jlwm_coo_actions','approved_by','text',FALSE,NULL,NULL),
      ('jlwm_coo_actions','approved_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_coo_actions','rejected_by','text',FALSE,NULL,NULL),
      ('jlwm_coo_actions','rejected_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_coo_actions','reject_reason','text',FALSE,NULL,NULL),
      ('jlwm_coo_actions','executed_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_coo_actions','execution_result','jsonb',FALSE,NULL,NULL),
      ('jlwm_coo_actions','expires_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_coo_actions','created_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_coo_actions','updated_at','timestamptz',TRUE,'now',NULL)
    ) AS expected_column(
      table_name, column_name, expected_udt, required_not_null, default_kind, expected_default
    )
  LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = column_spec.table_name;
    IF NOT FOUND OR actual_relkind NOT IN ('r', 'p') THEN
      /* Table missing or incompatible — skip data probes; missing_tables /
         incompatible_objects already recorded in step 1. */
      CONTINUE;
    END IF;

    actual_udt := NULL;
    actual_nullable := NULL;
    actual_default := NULL;
    SELECT c.udt_name, c.is_nullable, c.column_default
      INTO actual_udt, actual_nullable, actual_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = column_spec.table_name
      AND c.column_name = column_spec.column_name;

    IF NOT FOUND THEN
      missing_columns := array_append(
        missing_columns,
        format('%s.%s', column_spec.table_name, column_spec.column_name)
      );
      CONTINUE;
    END IF;

    IF actual_udt IS DISTINCT FROM column_spec.expected_udt THEN
      incompatible_types := array_append(
        incompatible_types,
        format('%s.%s(expected=%s,actual=%s)',
          column_spec.table_name, column_spec.column_name,
          column_spec.expected_udt, coalesce(actual_udt, '<null>'))
      );
    END IF;

    IF column_spec.required_not_null THEN
      IF actual_nullable IS DISTINCT FROM 'NO' THEN
        missing_not_null := array_append(
          missing_not_null,
          format('%s.%s', column_spec.table_name, column_spec.column_name)
        );
      END IF;

      /* Safe IS NULL probe only after column confirmed present. */
      EXECUTE format(
        'SELECT count(*) FROM public.%I WHERE %I IS NULL',
        column_spec.table_name, column_spec.column_name
      ) INTO row_count;
      IF row_count > 0 THEN
        IF column_spec.column_name = 'office_id' THEN
          null_office_count := null_office_count + row_count;
          null_office_details := array_append(
            null_office_details,
            format('%s=%s', column_spec.table_name, row_count)
          );
        ELSE
          null_required_count := null_required_count + row_count;
          null_required_details := array_append(
            null_required_details,
            format('%s.%s=%s', column_spec.table_name, column_spec.column_name, row_count)
          );
        END IF;
      END IF;
    END IF;

    IF column_spec.default_kind IS NULL THEN
      /* no default expected */
      NULL;
    ELSIF column_spec.default_kind = 'literal' THEN
      normalized_default := regexp_replace(
        trim(both from split_part(coalesce(actual_default, ''), '::', 1)),
        '''', '', 'g'
      );
      IF normalized_default IS DISTINCT FROM column_spec.expected_default THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected=%s,actual=%s)',
            column_spec.table_name, column_spec.column_name,
            column_spec.expected_default,
            coalesce(nullif(normalized_default, ''), '<none>'))
        );
      END IF;
    ELSIF column_spec.default_kind = 'uuid_text' THEN
      IF coalesce(actual_default, '') NOT ILIKE '%gen_random_uuid%' THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected=gen_random_uuid,actual=%s)',
            column_spec.table_name, column_spec.column_name,
            coalesce(actual_default, '<none>'))
        );
      END IF;
    ELSIF column_spec.default_kind = 'now' THEN
      IF coalesce(actual_default, '') NOT ILIKE '%now()%' THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected=now(),actual=%s)',
            column_spec.table_name, column_spec.column_name,
            coalesce(actual_default, '<none>'))
        );
      END IF;
    ELSIF column_spec.default_kind = 'jsonb_obj' THEN
      IF coalesce(actual_default, '') NOT ILIKE '%{}%' THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected={},actual=%s)',
            column_spec.table_name, column_spec.column_name,
            coalesce(actual_default, '<none>'))
        );
      END IF;
    ELSIF column_spec.default_kind = 'jsonb_arr' THEN
      IF coalesce(actual_default, '') NOT ILIKE '%[]%' THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected=[],actual=%s)',
            column_spec.table_name, column_spec.column_name,
            coalesce(actual_default, '<none>'))
        );
      END IF;
    END IF;
  END LOOP;

  /* ── 3) Non-UUID office_id (only when office_id text column exists) ───── */
  FOREACH tbl IN ARRAY owned_tables LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl;
    IF NOT FOUND OR actual_relkind NOT IN ('r', 'p') THEN
      CONTINUE;
    END IF;

    probe_safe := EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = tbl
        AND c.column_name = 'office_id'
        AND c.udt_name = 'text'
    );
    IF NOT probe_safe THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      $q$SELECT count(*) FROM public.%I
         WHERE office_id IS NOT NULL AND office_id !~ %L$q$,
      tbl, uuid_re
    ) INTO row_count;
    IF row_count > 0 THEN
      non_uuid_count := non_uuid_count + row_count;
      non_uuid_details := array_append(
        non_uuid_details,
        format('%s=%s', tbl, row_count)
      );
    END IF;
  END LOOP;

  /* ── 4) PRIMARY KEY (id) on every present table ───────────────────────── */
  FOREACH tbl IN ARRAY owned_tables LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl;
    IF NOT FOUND OR actual_relkind NOT IN ('r', 'p') THEN
      CONTINUE;
    END IF;

    pk_exists := EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', tbl))
        AND c.contype = 'p'
    );
    IF pk_exists THEN
      SELECT ARRAY(
        SELECT a.attname::TEXT
        FROM unnest(c.conkey) WITH ORDINALITY AS key_col(attnum, ordinality)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = key_col.attnum
         AND NOT a.attisdropped
        ORDER BY key_col.ordinality
      )
        INTO pk_cols
      FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', tbl))
        AND c.contype = 'p'
      LIMIT 1;

      IF pk_cols IS DISTINCT FROM ARRAY['id']::TEXT[] THEN
        incompatible_pks := array_append(
          incompatible_pks,
          format('%s(expected={id},actual=%s)', tbl, coalesce(pk_cols::TEXT, '<null>'))
        );
      END IF;
    ELSE
      missing_pks := array_append(missing_pks, format('%s(id)', tbl));
    END IF;
  END LOOP;

  /* ── 5) Named indexes (non-unique, non-partial; optional DESC last key) ─ */
  FOR index_spec IN
    SELECT * FROM (VALUES
      ('idx_jfp_office','jlwm_future_paths',ARRAY['office_id']::TEXT[],false),
      ('idx_jfp_subject','jlwm_future_paths',ARRAY['subject_type','subject_id']::TEXT[],false),
      ('idx_jsim_office','jlwm_simulations',ARRAY['office_id']::TEXT[],false),
      ('idx_jsim_case','jlwm_simulations',ARRAY['case_id']::TEXT[],false),
      ('idx_jli_office','jlwm_litigation_intel',ARRAY['office_id']::TEXT[],false),
      ('idx_jli_case','jlwm_litigation_intel',ARRAY['case_id']::TEXT[],false),
      ('idx_jac_office','jlwm_accuracy_records',ARRAY['office_id']::TEXT[],false),
      ('idx_jac_type','jlwm_accuracy_records',ARRAY['office_id','prediction_type']::TEXT[],false),
      ('idx_jac_case','jlwm_accuracy_records',ARRAY['office_id','case_id']::TEXT[],false),
      ('idx_jer_office','jlwm_executive_reports',ARRAY['office_id']::TEXT[],false),
      ('idx_jer_type','jlwm_executive_reports',ARRAY['office_id','report_type','generated_at']::TEXT[],true),
      ('idx_jca_office','jlwm_coo_actions',ARRAY['office_id']::TEXT[],false),
      ('idx_jca_status','jlwm_coo_actions',ARRAY['office_id','status']::TEXT[],false),
      ('idx_jca_type','jlwm_coo_actions',ARRAY['office_id','action_type']::TEXT[],false),
      ('idx_jca_priority','jlwm_coo_actions',ARRAY['office_id','priority','created_at']::TEXT[],true)
    ) AS expected_index(index_name, table_name, expected_cols, is_desc_last)
  LOOP
    /* Missing target table → index gap; skip catalog probe */
    IF to_regclass(format('public.%I', index_spec.table_name)) IS NULL THEN
      missing_indexes := array_append(missing_indexes, index_spec.index_name);
      CONTINUE;
    END IF;

    index_oid := NULL;
    index_relkind := NULL;
    index_table := NULL;
    index_unique := NULL;
    index_partial := NULL;
    index_expression := NULL;
    index_valid := NULL;
    index_ready := NULL;
    index_cols := NULL;
    index_opts := NULL;

    SELECT
      i.oid, i.relkind, t.relname, x.indisunique, x.indpred IS NOT NULL,
      x.indexprs IS NOT NULL, x.indisvalid, x.indisready,
      (
        SELECT array_agg(a.attname::TEXT ORDER BY key_col.ordinality)
        FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS key_col(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid AND a.attnum = key_col.attnum AND NOT a.attisdropped
      ),
      (
        SELECT array_agg(o::INT ORDER BY ord.ordinality)
        FROM unnest(x.indoption) WITH ORDINALITY AS ord(o, ordinality)
      )
    INTO
      index_oid, index_relkind, index_table, index_unique, index_partial,
      index_expression, index_valid, index_ready, index_cols, index_opts
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    LEFT JOIN pg_class t ON t.oid = x.indrelid
    WHERE n.nspname = 'public' AND i.relname = index_spec.index_name;

    IF NOT FOUND THEN
      missing_indexes := array_append(missing_indexes, index_spec.index_name);
    ELSE
      /* indoption bit 0 = DESC */
      index_has_desc := false;
      last_has_desc := false;
      IF index_opts IS NOT NULL AND cardinality(index_opts) > 0 THEN
        FOR opts_i IN 1..cardinality(index_opts) LOOP
          IF (index_opts[opts_i] & 1) = 1 THEN
            index_has_desc := true;
          END IF;
        END LOOP;
        last_has_desc := (index_opts[cardinality(index_opts)] & 1) = 1;
      END IF;

      IF index_relkind NOT IN ('i', 'I')
         OR index_table IS DISTINCT FROM index_spec.table_name
         OR index_unique IS DISTINCT FROM FALSE
         OR index_partial IS DISTINCT FROM FALSE
         OR index_expression IS DISTINCT FROM FALSE
         OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE
         OR index_cols IS DISTINCT FROM index_spec.expected_cols
         OR (
           CASE
             WHEN index_spec.is_desc_last THEN
               last_has_desc IS DISTINCT FROM TRUE
             ELSE
               index_has_desc IS DISTINCT FROM FALSE
           END
         ) THEN
        incompatible_indexes := array_append(
          incompatible_indexes,
          format('%s(table=%s,cols=%s,unique=%s,partial=%s,expr=%s,desc_last=%s,opts=%s)',
            index_spec.index_name, coalesce(index_table,'<none>'),
            coalesce(index_cols::TEXT,'<none>'), coalesce(index_unique::TEXT,'<null>'),
            coalesce(index_partial::TEXT,'<null>'), coalesce(index_expression::TEXT,'<null>'),
            coalesce(last_has_desc::TEXT,'<null>'), coalesce(index_opts::TEXT,'<none>'))
        );
      END IF;
    END IF;
  END LOOP;

  /* ── 6) Decision ladder (blockers win over every safe repair) ─────────── */
  IF cardinality(incompatible_objects) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
    lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_types) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
    lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_PK';
    lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_INDEX';
    lock_risk := 'HIGH';
  ELSIF null_office_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'NULL_OFFICE_ID';
    lock_risk := 'HIGH';
  ELSIF null_required_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'NULL_REQUIRED';
    lock_risk := 'HIGH';
  ELSIF non_uuid_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'NON_UUID_OFFICE_ID';
    lock_risk := 'HIGH';

  /* Safe repairs — only after all blockers are absent */
  ELSIF cardinality(missing_tables) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'TABLE_MISSING';
    lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns) > 0
     OR cardinality(missing_pks) > 0
     OR cardinality(missing_indexes) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'MISSING_COLUMN_DEFAULTS';
    lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'SET_NOT_NULL_PENDING';
    lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'JLWM_SATELLITES_SCHEMA_READY';
    lock_risk := 'LOW';
  END IF;

  /* ── 7) Diagnostics notices ──────────────────────────────────────────── */
  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx > 1 THEN
      rows_notice := rows_notice || ' ';
    END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;

  RAISE NOTICE '035_preflight: estimated_rows %', rows_notice;
  RAISE NOTICE '035_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '035_preflight: non_uuid_office_id_count=% details=%',
    non_uuid_count,
    coalesce(nullif(array_to_string(non_uuid_details, ','), ''), empty_text);
  RAISE NOTICE '035_preflight: null_office_id_count=% details=%',
    null_office_count,
    coalesce(nullif(array_to_string(null_office_details, ','), ''), empty_text);
  RAISE NOTICE '035_preflight: null_required_count=% details=%',
    null_required_count,
    coalesce(nullif(array_to_string(null_required_details, ','), ''), empty_text);
  RAISE NOTICE '035_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects, ','), ''), empty_text),
    coalesce(nullif(array_to_string(incompatible_types, ','), ''), empty_text);
  RAISE NOTICE '035_preflight: incompatible_pks=% incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_pks, ','), ''), empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes, ','), ''), empty_text);
  RAISE NOTICE '035_preflight: missing_tables=%',
    coalesce(nullif(array_to_string(missing_tables, ','), ''), empty_text);
  RAISE NOTICE '035_preflight: missing_columns=%',
    coalesce(nullif(array_to_string(missing_columns, ','), ''), empty_text);
  RAISE NOTICE '035_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults, ','), ''), empty_text),
    coalesce(nullif(array_to_string(missing_not_null, ','), ''), empty_text);
  RAISE NOTICE '035_preflight: missing_pks=% missing_indexes=%',
    coalesce(nullif(array_to_string(missing_pks, ','), ''), empty_text),
    coalesce(nullif(array_to_string(missing_indexes, ','), ''), empty_text);

  RAISE NOTICE '035_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '035_preflight: BLOCK — do not apply Migration 035 until every reported blocker is resolved';
    RAISE EXCEPTION '035_preflight: chosen_action=% reason_code=%', action, reason_code;
  ELSIF action = 'SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '035_preflight: SAFE_AUTO_REPAIR — Migration 035 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '035_preflight: ALREADY_CORRECT — FULL READY (reason_code=JLWM_SATELLITES_SCHEMA_READY)';
  END IF;
END
$preflight$;
