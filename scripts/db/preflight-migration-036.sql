-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 036 — READ-ONLY checks for JLWM Reliability schema
--
-- This script reads catalogs/data and emits notices only. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Owned tables (5):
--   jlwm_ai_audit, jlwm_trust_scores, jlwm_recommendation_tracking,
--   jlwm_data_quality, jlwm_learning_events
--
-- Blockers are collected before the decision ladder. Any blocker wins over
-- every safe repair, including missing tables. Indexes are always probed by
-- name, even when their expected table is missing.
--
-- Reason codes:
--   INCOMPATIBLE_TYPE, NULL_OFFICE_ID, NON_UUID_OFFICE_ID, NULL_REQUIRED,
--   INCOMPATIBLE_PK, INCOMPATIBLE_INDEX
--   JLWM_RELIABILITY_SCHEMA_READY means ALREADY_CORRECT.
--
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 036 preflight: object presence'
SELECT
  to_regclass('public.jlwm_ai_audit') IS NOT NULL AS jlwm_ai_audit_present,
  to_regclass('public.jlwm_trust_scores') IS NOT NULL AS jlwm_trust_scores_present,
  to_regclass('public.jlwm_recommendation_tracking') IS NOT NULL AS jlwm_recommendation_tracking_present,
  to_regclass('public.jlwm_data_quality') IS NOT NULL AS jlwm_data_quality_present,
  to_regclass('public.jlwm_learning_events') IS NOT NULL AS jlwm_learning_events_present;

\echo '▶ 036 preflight: full contract and decision'
DO $preflight$
DECLARE
  uuid_re CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  owned_tables CONSTANT TEXT[] := ARRAY[
    'jlwm_ai_audit','jlwm_trust_scores','jlwm_recommendation_tracking',
    'jlwm_data_quality','jlwm_learning_events'
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

  estimated_rows BIGINT[] := ARRAY[0,0,0,0,0]::BIGINT[];
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
  pk_cols TEXT[];
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
  desc_ok BOOLEAN;
  opts_i INT;
  opts_len INT;
  empty_text TEXT := '<none>';
  rows_notice TEXT := '';
BEGIN
  -- ── 1) Presence, relkind, and row counts ─────────────────────────────────
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
      EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO row_count;
      estimated_rows[tbl_idx] := row_count;
    END IF;
  END LOOP;

  -- ── 2) All Runtime columns: type, required NULLs, and defaults ───────────
  FOR column_spec IN
    SELECT * FROM (VALUES
      ('jlwm_ai_audit','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_ai_audit','office_id','text',TRUE,NULL,NULL),
      ('jlwm_ai_audit','user_id','text',FALSE,NULL,NULL),
      ('jlwm_ai_audit','query_type','text',TRUE,NULL,NULL),
      ('jlwm_ai_audit','model_used','text',TRUE,NULL,NULL),
      ('jlwm_ai_audit','prompt_hash','text',FALSE,NULL,NULL),
      ('jlwm_ai_audit','input_summary','text',FALSE,NULL,NULL),
      ('jlwm_ai_audit','output_summary','text',FALSE,NULL,NULL),
      ('jlwm_ai_audit','confidence','float8',FALSE,NULL,NULL),
      ('jlwm_ai_audit','evidence_count','int4',FALSE,'literal','0'),
      ('jlwm_ai_audit','data_quality','float8',FALSE,NULL,NULL),
      ('jlwm_ai_audit','duration_ms','int4',FALSE,NULL,NULL),
      ('jlwm_ai_audit','tier','text',FALSE,NULL,NULL),
      ('jlwm_ai_audit','tokens_est','int4',FALSE,NULL,NULL),
      ('jlwm_ai_audit','viewed_by','text',FALSE,NULL,NULL),
      ('jlwm_ai_audit','created_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_trust_scores','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_trust_scores','office_id','text',TRUE,NULL,NULL),
      ('jlwm_trust_scores','trust_score','float8',TRUE,'literal','0'),
      ('jlwm_trust_scores','prediction_accuracy','float8',TRUE,'literal','0'),
      ('jlwm_trust_scores','data_quality','float8',TRUE,'literal','0'),
      ('jlwm_trust_scores','recommendation_success','float8',TRUE,'literal','0'),
      ('jlwm_trust_scores','stability_score','float8',TRUE,'literal','0'),
      ('jlwm_trust_scores','audit_completeness','float8',TRUE,'literal','0'),
      ('jlwm_trust_scores','label','text',TRUE,'literal','غير محدد'),
      ('jlwm_trust_scores','breakdown','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_trust_scores','computed_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_recommendation_tracking','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_recommendation_tracking','office_id','text',TRUE,NULL,NULL),
      ('jlwm_recommendation_tracking','recommendation_id','text',FALSE,NULL,NULL),
      ('jlwm_recommendation_tracking','title','text',TRUE,NULL,NULL),
      ('jlwm_recommendation_tracking','category','text',FALSE,NULL,NULL),
      ('jlwm_recommendation_tracking','was_applied','bool',FALSE,NULL,NULL),
      ('jlwm_recommendation_tracking','outcome_improved','bool',FALSE,NULL,NULL),
      ('jlwm_recommendation_tracking','risk_reduced','bool',FALSE,NULL,NULL),
      ('jlwm_recommendation_tracking','success_score','float8',FALSE,NULL,NULL),
      ('jlwm_recommendation_tracking','notes','text',FALSE,NULL,NULL),
      ('jlwm_recommendation_tracking','applied_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_recommendation_tracking','measured_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_recommendation_tracking','created_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_data_quality','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_data_quality','office_id','text',TRUE,NULL,NULL),
      ('jlwm_data_quality','overall_score','float8',TRUE,'literal','0'),
      ('jlwm_data_quality','cases_score','float8',TRUE,'literal','0'),
      ('jlwm_data_quality','clients_score','float8',TRUE,'literal','0'),
      ('jlwm_data_quality','documents_score','float8',TRUE,'literal','0'),
      ('jlwm_data_quality','tasks_score','float8',TRUE,'literal','0'),
      ('jlwm_data_quality','sessions_score','float8',TRUE,'literal','0'),
      ('jlwm_data_quality','breakdown','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_data_quality','issues','jsonb',TRUE,'jsonb_arr',NULL),
      ('jlwm_data_quality','computed_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_learning_events','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_learning_events','office_id','text',TRUE,NULL,NULL),
      ('jlwm_learning_events','event_type','text',TRUE,NULL,NULL),
      ('jlwm_learning_events','source_id','text',FALSE,NULL,NULL),
      ('jlwm_learning_events','source_type','text',FALSE,NULL,NULL),
      ('jlwm_learning_events','pattern_key','text',FALSE,NULL,NULL),
      ('jlwm_learning_events','old_weight','float8',FALSE,NULL,NULL),
      ('jlwm_learning_events','new_weight','float8',FALSE,NULL,NULL),
      ('jlwm_learning_events','delta','float8',FALSE,NULL,NULL),
      ('jlwm_learning_events','evidence','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_learning_events','created_at','timestamptz',TRUE,'now',NULL)
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
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL',
        column_spec.table_name,column_spec.column_name) INTO row_count;
      IF row_count > 0 THEN
        IF column_spec.column_name='office_id' THEN
          null_office_count := null_office_count + row_count;
          null_office_details := array_append(null_office_details,format('%s=%s',column_spec.table_name,row_count));
        ELSE
          null_required_count := null_required_count + row_count;
          null_required_details := array_append(
            null_required_details,format('%s.%s=%s',column_spec.table_name,column_spec.column_name,row_count)
          );
        END IF;
      END IF;
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
    ELSIF column_spec.default_kind='uuid_text' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%gen_random_uuid%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=gen_random_uuid,actual=%s)',column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    ELSIF column_spec.default_kind='now' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%now()%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=now(),actual=%s)',column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    ELSIF column_spec.default_kind='jsonb_obj' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%{}%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected={},actual=%s)',column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    ELSIF column_spec.default_kind='jsonb_arr' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%[]%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=[],actual=%s)',column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    END IF;
  END LOOP;

  -- ── 3) Non-UUID ownership probes (only after office_id is confirmed text)
  FOREACH tbl IN ARRAY owned_tables LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=tbl;
    IF NOT FOUND OR actual_relkind NOT IN ('r','p') THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=tbl
        AND c.column_name='office_id' AND c.udt_name='text'
    ) THEN
      EXECUTE format(
        $q$SELECT count(*) FROM public.%I
           WHERE office_id IS NOT NULL AND office_id !~ %L$q$,tbl,uuid_re
      ) INTO row_count;
      IF row_count > 0 THEN
        non_uuid_count := non_uuid_count + row_count;
        non_uuid_details := array_append(non_uuid_details,format('%s=%s',tbl,row_count));
      END IF;
    END IF;
  END LOOP;

  -- ── 4) PRIMARY KEY (id) on every present table ───────────────────────────
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

  -- ── 5) Named indexes: always probe by name, including missing tables ─────
  FOR index_spec IN
    SELECT * FROM (VALUES
      ('idx_jaa_office','jlwm_ai_audit',ARRAY['office_id']::TEXT[],false),
      ('idx_jaa_type','jlwm_ai_audit',ARRAY['office_id','query_type','created_at']::TEXT[],true),
      ('idx_jts_office','jlwm_trust_scores',ARRAY['office_id','computed_at']::TEXT[],true),
      ('idx_jrt_office','jlwm_recommendation_tracking',ARRAY['office_id']::TEXT[],false),
      ('idx_jdq_office','jlwm_data_quality',ARRAY['office_id','computed_at']::TEXT[],true),
      ('idx_jle_office','jlwm_learning_events',ARRAY['office_id','created_at']::TEXT[],true)
    ) AS expected_index(index_name,table_name,expected_cols,is_desc_last)
  LOOP
    index_oid := NULL; index_relkind := NULL; index_table := NULL;
    index_unique := NULL; index_partial := NULL; index_expression := NULL;
    index_valid := NULL; index_ready := NULL; index_cols := NULL; index_opts := NULL;
    SELECT i.oid,i.relkind,t.relname,x.indisunique,x.indpred IS NOT NULL,
      x.indexprs IS NOT NULL,x.indisvalid,x.indisready,
      (SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality)
       FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum,ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::INT ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o,ordinality))
    INTO index_oid,index_relkind,index_table,index_unique,index_partial,index_expression,
      index_valid,index_ready,index_cols,index_opts
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    LEFT JOIN pg_class t ON t.oid=x.indrelid
    WHERE n.nspname='public' AND i.relname=index_spec.index_name;

    IF NOT FOUND THEN
      missing_indexes := array_append(missing_indexes,index_spec.index_name);
    ELSE
      desc_ok := true;
      opts_len := COALESCE(cardinality(index_opts),0);
      IF index_opts IS NULL OR opts_len IS DISTINCT FROM cardinality(index_spec.expected_cols) THEN
        desc_ok := false;
      ELSIF index_spec.is_desc_last THEN
        IF (index_opts[opts_len] & 1) IS DISTINCT FROM 1 THEN desc_ok := false; END IF;
        FOR opts_i IN 1..opts_len-1 LOOP
          IF (index_opts[opts_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
        END LOOP;
      ELSE
        FOR opts_i IN 1..opts_len LOOP
          IF (index_opts[opts_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
        END LOOP;
      END IF;
      IF index_relkind NOT IN ('i','I')
         OR index_table IS DISTINCT FROM index_spec.table_name
         OR index_unique IS DISTINCT FROM FALSE OR index_partial IS DISTINCT FROM FALSE
         OR index_expression IS DISTINCT FROM FALSE OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE OR index_cols IS DISTINCT FROM index_spec.expected_cols
         OR desc_ok IS NOT TRUE THEN
        incompatible_indexes := array_append(incompatible_indexes,
          format('%s(table=%s,cols=%s,unique=%s,partial=%s,expr=%s,desc_ok=%s,opts=%s)',
            index_spec.index_name,coalesce(index_table,'<none>'),coalesce(index_cols::TEXT,'<none>'),
            coalesce(index_unique::TEXT,'<null>'),coalesce(index_partial::TEXT,'<null>'),
            coalesce(index_expression::TEXT,'<null>'),coalesce(desc_ok::TEXT,'<null>'),
            coalesce(index_opts::TEXT,'<none>')));
      END IF;
    END IF;
  END LOOP;

  -- ── 6) Blocker-first decision ladder ─────────────────────────────────────
  IF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_INDEX'; lock_risk := 'HIGH';
  ELSIF null_office_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_OFFICE_ID'; lock_risk := 'HIGH';
  ELSIF null_required_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF non_uuid_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NON_UUID_OFFICE_ID'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0
     OR cardinality(missing_indexes)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_COLUMN_DEFAULTS'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'JLWM_RELIABILITY_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  -- ── 7) Diagnostics and fail-closed result ────────────────────────────────
  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx>1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '036_preflight: estimated_rows %',rows_notice;
  RAISE NOTICE '036_preflight: lock_risk=%',lock_risk;
  RAISE NOTICE '036_preflight: non_uuid_office_id_count=% details=%',non_uuid_count,
    coalesce(nullif(array_to_string(non_uuid_details,','),''),empty_text);
  RAISE NOTICE '036_preflight: null_office_id_count=% details=%',null_office_count,
    coalesce(nullif(array_to_string(null_office_details,','),''),empty_text);
  RAISE NOTICE '036_preflight: null_required_count=% details=%',null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''),empty_text);
  RAISE NOTICE '036_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''),empty_text);
  RAISE NOTICE '036_preflight: incompatible_pks=% incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes,','),''),empty_text);
  RAISE NOTICE '036_preflight: missing_tables=%',coalesce(nullif(array_to_string(missing_tables,','),''),empty_text);
  RAISE NOTICE '036_preflight: missing_columns=%',coalesce(nullif(array_to_string(missing_columns,','),''),empty_text);
  RAISE NOTICE '036_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''),empty_text);
  RAISE NOTICE '036_preflight: missing_pks=% missing_indexes=%',
    coalesce(nullif(array_to_string(missing_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_indexes,','),''),empty_text);
  RAISE NOTICE '036_preflight: chosen_action=% reason_code=%',action,reason_code;

  IF action='BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '036_preflight: BLOCK — do not apply Migration 036 until every blocker is resolved';
    RAISE EXCEPTION '036_preflight: chosen_action=% reason_code=%',action,reason_code;
  ELSIF action='SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '036_preflight: SAFE_AUTO_REPAIR — Migration 036 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '036_preflight: ALREADY_CORRECT — FULL READY (reason_code=JLWM_RELIABILITY_SCHEMA_READY)';
  END IF;
END
$preflight$;
