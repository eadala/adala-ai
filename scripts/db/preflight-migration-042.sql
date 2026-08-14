-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 042 — READ-ONLY checks for AI Agents schema
--
-- This script reads catalogs/data and emits notices only. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Owned objects:
--   ai_agents
--   agent_actions
--   agent_job_logs
--   idx_agent_job_logs_created — (created_at DESC)
--   idx_agent_job_logs_type — (agent_type)
--
-- No invented UNIQUE/FK. agent_job_logs.office_id is nullable TEXT.
-- Seed presence is informational (migration inserts ON CONFLICT DO NOTHING);
-- missing seed rows alone do not BLOCK (SAFE via migration apply).
--
-- Blockers are collected before the decision ladder. Any blocker wins over
-- every safe repair, including missing tables. Indexes are probed by GLOBAL
-- NAME even when agent_job_logs is missing (stolen-name → INCOMPATIBLE_INDEX).
--
-- Reason codes:
--   INCOMPATIBLE_TYPE, INCOMPATIBLE_PK, INCOMPATIBLE_INDEX,
--   NULL_REQUIRED, TABLE_MISSING, PARTIAL_SCHEMA,
--   MISSING_INDEXES, MISSING_COLUMN_DEFAULTS, SET_NOT_NULL_PENDING.
--   AI_AGENTS_SCHEMA_READY means ALREADY_CORRECT.
--
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 042 preflight: object presence'
SELECT
  to_regclass('public.ai_agents') IS NOT NULL AS ai_agents_present,
  to_regclass('public.agent_actions') IS NOT NULL AS agent_actions_present,
  to_regclass('public.agent_job_logs') IS NOT NULL AS agent_job_logs_present;

\echo '▶ 042 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY['ai_agents','agent_actions','agent_job_logs']::TEXT[];

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
  null_required_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0,0,0]::BIGINT[];
  null_required_count BIGINT := 0;
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

  idx_relkind "char";
  idx_table TEXT;
  idx_unique BOOLEAN;
  idx_partial BOOLEAN;
  idx_expr BOOLEAN;
  idx_valid BOOLEAN;
  idx_ready BOOLEAN;
  idx_cols TEXT[];
  idx_opts INT[];
  desc_ok BOOLEAN;
  asc_ok BOOLEAN;
  opts_len INT;
  opts_i INT;

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
  -- agent_job_logs.office_id is nullable (exact Runtime).
  FOR column_spec IN
    SELECT * FROM (VALUES
      ('ai_agents','id','text',TRUE,NULL,NULL),
      ('ai_agents','name','text',TRUE,NULL,NULL),
      ('ai_agents','name_ar','text',TRUE,NULL,NULL),
      ('ai_agents','type','text',TRUE,NULL,NULL),
      ('ai_agents','description','text',FALSE,NULL,NULL),
      ('ai_agents','status','text',FALSE,'literal','active'),
      ('ai_agents','last_run','timestamptz',FALSE,NULL,NULL),
      ('ai_agents','run_count','int4',FALSE,'literal','0'),
      ('ai_agents','memory','jsonb',FALSE,'jsonb_obj',NULL),
      ('ai_agents','created_at','timestamptz',FALSE,'now',NULL),
      ('agent_actions','id','int8',TRUE,NULL,NULL),
      ('agent_actions','agent_id','text',TRUE,NULL,NULL),
      ('agent_actions','event_type','text',TRUE,NULL,NULL),
      ('agent_actions','decision','text',TRUE,NULL,NULL),
      ('agent_actions','title','text',TRUE,NULL,NULL),
      ('agent_actions','body','text',FALSE,NULL,NULL),
      ('agent_actions','payload','jsonb',FALSE,'jsonb_obj',NULL),
      ('agent_actions','severity','text',FALSE,'literal','info'),
      ('agent_actions','status','text',FALSE,'literal','pending'),
      ('agent_actions','created_at','timestamptz',FALSE,'now',NULL),
      ('agent_actions','resolved_at','timestamptz',FALSE,NULL,NULL),
      ('agent_job_logs','id','int8',TRUE,NULL,NULL),
      ('agent_job_logs','agent_type','text',TRUE,NULL,NULL),
      ('agent_job_logs','status','text',TRUE,'literal','running'),
      ('agent_job_logs','office_id','text',FALSE,NULL,NULL),
      ('agent_job_logs','summary','text',FALSE,NULL,NULL),
      ('agent_job_logs','details','jsonb',FALSE,NULL,NULL),
      ('agent_job_logs','duration_ms','int4',FALSE,NULL,NULL),
      ('agent_job_logs','created_at','timestamptz',FALSE,'now',NULL),
      ('agent_job_logs','completed_at','timestamptz',FALSE,NULL,NULL)
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
    ELSIF column_spec.default_kind='jsonb_obj' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%{}%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected={},actual=%s)',column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    END IF;
  END LOOP;

  -- PK (id) probe
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

  -- idx_agent_job_logs_created ALWAYS probed by NAME globally (039/041 pattern).
  idx_relkind := NULL; idx_table := NULL; idx_unique := NULL;
  idx_partial := NULL; idx_expr := NULL; idx_valid := NULL; idx_ready := NULL;
  idx_cols := NULL; idx_opts := NULL;
  SELECT i.relkind, t.relname, x.indisunique, x.indpred IS NOT NULL,
         x.indexprs IS NOT NULL, x.indisvalid, x.indisready,
         (SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality)
          FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum, ordinality)
          LEFT JOIN pg_attribute a
            ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
         (SELECT array_agg(o::INT ORDER BY k.ordinality)
          FROM unnest(x.indoption) WITH ORDINALITY AS k(o,ordinality))
  INTO idx_relkind, idx_table, idx_unique, idx_partial, idx_expr,
       idx_valid, idx_ready, idx_cols, idx_opts
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  LEFT JOIN pg_index x ON x.indexrelid = i.oid
  LEFT JOIN pg_class t ON t.oid = x.indrelid
  WHERE n.nspname = 'public' AND i.relname = 'idx_agent_job_logs_created';

  IF NOT FOUND THEN
    missing_indexes := array_append(missing_indexes, 'idx_agent_job_logs_created');
  ELSE
    desc_ok := true;
    opts_len := COALESCE(cardinality(idx_opts),0);
    IF idx_opts IS NULL OR opts_len IS DISTINCT FROM 1 THEN
      desc_ok := false;
    ELSIF (idx_opts[1] & 1) IS DISTINCT FROM 1 THEN
      desc_ok := false;
    END IF;
    IF idx_relkind NOT IN ('i','I')
       OR idx_table IS DISTINCT FROM 'agent_job_logs'
       OR idx_unique IS DISTINCT FROM FALSE
       OR idx_partial IS DISTINCT FROM FALSE
       OR idx_expr IS DISTINCT FROM FALSE
       OR idx_valid IS DISTINCT FROM TRUE
       OR idx_ready IS DISTINCT FROM TRUE
       OR idx_cols IS DISTINCT FROM ARRAY['created_at']::TEXT[]
       OR desc_ok IS NOT TRUE THEN
      incompatible_indexes := array_append(incompatible_indexes,
        format('idx_agent_job_logs_created(table=%s,cols=%s,unique=%s,partial=%s,expr=%s,desc_ok=%s,opts=%s,valid=%s,ready=%s)',
          coalesce(idx_table,'<none>'),
          coalesce(idx_cols::TEXT,'<none>'),
          coalesce(idx_unique::TEXT,'<null>'),
          coalesce(idx_partial::TEXT,'<null>'),
          coalesce(idx_expr::TEXT,'<null>'),
          coalesce(desc_ok::TEXT,'<null>'),
          coalesce(idx_opts::TEXT,'<none>'),
          coalesce(idx_valid::TEXT,'<null>'),
          coalesce(idx_ready::TEXT,'<null>')));
    END IF;
  END IF;

  -- idx_agent_job_logs_type ALWAYS probed by NAME globally.
  idx_relkind := NULL; idx_table := NULL; idx_unique := NULL;
  idx_partial := NULL; idx_expr := NULL; idx_valid := NULL; idx_ready := NULL;
  idx_cols := NULL; idx_opts := NULL;
  SELECT i.relkind, t.relname, x.indisunique, x.indpred IS NOT NULL,
         x.indexprs IS NOT NULL, x.indisvalid, x.indisready,
         (SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality)
          FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum, ordinality)
          LEFT JOIN pg_attribute a
            ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
         (SELECT array_agg(o::INT ORDER BY k.ordinality)
          FROM unnest(x.indoption) WITH ORDINALITY AS k(o,ordinality))
  INTO idx_relkind, idx_table, idx_unique, idx_partial, idx_expr,
       idx_valid, idx_ready, idx_cols, idx_opts
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  LEFT JOIN pg_index x ON x.indexrelid = i.oid
  LEFT JOIN pg_class t ON t.oid = x.indrelid
  WHERE n.nspname = 'public' AND i.relname = 'idx_agent_job_logs_type';

  IF NOT FOUND THEN
    missing_indexes := array_append(missing_indexes, 'idx_agent_job_logs_type');
  ELSE
    asc_ok := true;
    opts_len := COALESCE(cardinality(idx_opts),0);
    IF idx_opts IS NULL OR opts_len IS DISTINCT FROM 1 THEN
      asc_ok := false;
    ELSE
      FOR opts_i IN 1..opts_len LOOP
        IF (idx_opts[opts_i] & 1) IS DISTINCT FROM 0 THEN asc_ok := false; END IF;
      END LOOP;
    END IF;
    IF idx_relkind NOT IN ('i','I')
       OR idx_table IS DISTINCT FROM 'agent_job_logs'
       OR idx_unique IS DISTINCT FROM FALSE
       OR idx_partial IS DISTINCT FROM FALSE
       OR idx_expr IS DISTINCT FROM FALSE
       OR idx_valid IS DISTINCT FROM TRUE
       OR idx_ready IS DISTINCT FROM TRUE
       OR idx_cols IS DISTINCT FROM ARRAY['agent_type']::TEXT[]
       OR asc_ok IS NOT TRUE THEN
      incompatible_indexes := array_append(incompatible_indexes,
        format('idx_agent_job_logs_type(table=%s,cols=%s,unique=%s,partial=%s,expr=%s,asc_ok=%s,opts=%s,valid=%s,ready=%s)',
          coalesce(idx_table,'<none>'),
          coalesce(idx_cols::TEXT,'<none>'),
          coalesce(idx_unique::TEXT,'<null>'),
          coalesce(idx_partial::TEXT,'<null>'),
          coalesce(idx_expr::TEXT,'<null>'),
          coalesce(asc_ok::TEXT,'<null>'),
          coalesce(idx_opts::TEXT,'<none>'),
          coalesce(idx_valid::TEXT,'<null>'),
          coalesce(idx_ready::TEXT,'<null>')));
    END IF;
  END IF;

  -- Any blocker wins over every safe repair, including missing tables.
  IF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_INDEX'; lock_risk := 'HIGH';
  ELSIF null_required_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_indexes)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_INDEXES'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_COLUMN_DEFAULTS'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'AI_AGENTS_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx>1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '042_preflight: estimated_rows %',rows_notice;
  RAISE NOTICE '042_preflight: lock_risk=%',lock_risk;
  RAISE NOTICE '042_preflight: null_required_count=% details=%',null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''),empty_text);
  RAISE NOTICE '042_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''),empty_text);
  RAISE NOTICE '042_preflight: incompatible_pks=% incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes,','),''),empty_text);
  RAISE NOTICE '042_preflight: missing_tables=%',
    coalesce(nullif(array_to_string(missing_tables,','),''),empty_text);
  RAISE NOTICE '042_preflight: missing_columns=%',coalesce(nullif(array_to_string(missing_columns,','),''),empty_text);
  RAISE NOTICE '042_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''),empty_text);
  RAISE NOTICE '042_preflight: missing_pks=% missing_indexes=%',
    coalesce(nullif(array_to_string(missing_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_indexes,','),''),empty_text);
  RAISE NOTICE '042_preflight: chosen_action=% reason_code=%',action,reason_code;

  IF action='BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '042_preflight: BLOCK — do not apply Migration 042 until every blocker is resolved';
    RAISE EXCEPTION '042_preflight: chosen_action=% reason_code=%',action,reason_code;
  ELSIF action='SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '042_preflight: SAFE_AUTO_REPAIR — Migration 042 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '042_preflight: ALREADY_CORRECT — FULL READY (reason_code=AI_AGENTS_SCHEMA_READY)';
  END IF;
END
$preflight$;
