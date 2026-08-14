-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 040 — READ-ONLY checks for AI Provider Engine schema
--
-- This script reads catalogs/data and emits notices only. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Owned tables (2):
--   ai_provider_config (+ UNIQUE(provider)),
--   office_ai_settings (+ UNIQUE(office_id))
--
-- office_id is a TEXT business key: no default, never UUID-validated,
-- never treated as a blocker for non-UUID values.
--
-- Blockers are collected before the decision ladder. Any blocker wins over
-- every safe repair, including missing tables.
--
-- Reason codes:
--   INCOMPATIBLE_TYPE, INCOMPATIBLE_PK, INCOMPATIBLE_UNIQUE,
--   DUPLICATE_UNIQUE_KEY, NULL_REQUIRED, TABLE_MISSING, PARTIAL_SCHEMA,
--   MISSING_COLUMN_DEFAULTS, SET_NOT_NULL_PENDING.
--   AI_PROVIDER_ENGINE_SCHEMA_READY means ALREADY_CORRECT.
--
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 040 preflight: object presence'
SELECT
  to_regclass('public.ai_provider_config') IS NOT NULL AS ai_provider_config_present,
  to_regclass('public.office_ai_settings') IS NOT NULL AS office_ai_settings_present;

\echo '▶ 040 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY[
    'ai_provider_config','office_ai_settings'
  ]::TEXT[];

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
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0,0]::BIGINT[];
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
  -- office_id is intentionally excluded from any UUID-shape check and has no default.
  FOR column_spec IN
    SELECT * FROM (VALUES
      ('ai_provider_config','id','int4',TRUE,NULL,NULL),
      ('ai_provider_config','provider','text',TRUE,NULL,NULL),
      ('ai_provider_config','label_ar','text',TRUE,'literal',''),
      ('ai_provider_config','enabled','bool',TRUE,'literal','true'),
      ('ai_provider_config','priority','int4',TRUE,'literal','5'),
      ('ai_provider_config','cost_per_token','numeric',TRUE,'literal','0'),
      ('ai_provider_config','cost_per_request','numeric',TRUE,'literal','0'),
      ('ai_provider_config','monthly_limit','int4',FALSE,NULL,NULL),
      ('ai_provider_config','current_usage','int4',TRUE,'literal','0'),
      ('ai_provider_config','model_name','text',TRUE,'literal',''),
      ('ai_provider_config','notes','text',FALSE,NULL,NULL),
      ('ai_provider_config','updated_at','timestamptz',TRUE,'now',NULL),
      ('office_ai_settings','id','int4',TRUE,NULL,NULL),
      ('office_ai_settings','office_id','text',TRUE,NULL,NULL),
      ('office_ai_settings','preferred_provider','text',TRUE,'literal','auto'),
      ('office_ai_settings','mode','text',TRUE,'literal','balanced'),
      ('office_ai_settings','allowed_providers','_text',FALSE,'text_arr',NULL),
      ('office_ai_settings','max_monthly_spend','numeric',FALSE,NULL,NULL),
      ('office_ai_settings','smart_routing','bool',TRUE,'literal','true'),
      ('office_ai_settings','custom_rules','jsonb',FALSE,'jsonb_obj',NULL),
      ('office_ai_settings','updated_at','timestamptz',TRUE,'now',NULL)
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
    ELSIF column_spec.default_kind='text_arr' THEN
      -- Expected: ARRAY['gemini','claude','openai','deepseek'] (any PG spelling).
      IF coalesce(actual_default,'') !~* 'gemini'
         OR coalesce(actual_default,'') !~* 'claude'
         OR coalesce(actual_default,'') !~* 'openai'
         OR coalesce(actual_default,'') !~* 'deepseek' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=ARRAY[gemini,claude,openai,deepseek],actual=%s)',
            column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    END IF;
  END LOOP;

  -- Duplicate provider groups on ai_provider_config (would block UNIQUE(provider)).
  IF to_regclass('public.ai_provider_config') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT provider FROM public.ai_provider_config GROUP BY provider HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('ai_provider_config(provider)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;

  -- Duplicate office_id groups on office_ai_settings (would block UNIQUE(office_id)).
  IF to_regclass('public.office_ai_settings') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT office_id FROM public.office_ai_settings GROUP BY office_id HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('office_ai_settings(office_id)=%s', row_count));
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

  -- ai_provider_config UNIQUE(provider): exact single-column only. Wider/
  -- wrong-order/partial/expression/invalid/not-ready near-miss shapes →
  -- INCOMPATIBLE_UNIQUE (never false READY).
  IF to_regclass('public.ai_provider_config') IS NOT NULL THEN
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='ai_provider_config';
    IF FOUND AND actual_relkind IN ('r','p') THEN
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.ai_provider_config'::regclass AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*provider\s*\)'
          AND pg_get_constraintdef(c.oid) !~* ','
      ) OR EXISTS (
        SELECT 1 FROM pg_index x
        WHERE x.indrelid = 'public.ai_provider_config'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
          AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
               FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
               JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
              = ARRAY['provider']::text[]
      ) INTO has_uq;

      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.ai_provider_config'::regclass AND c.contype = 'u'
          AND c.conname = 'ai_provider_config_provider_key'
          AND (
            pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*provider\s*\)'
            OR pg_get_constraintdef(c.oid) ~* ','
          )
      ) INTO wrong_uq;

      SELECT EXISTS (
        SELECT 1 FROM pg_index x
        WHERE x.indrelid = 'public.ai_provider_config'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
               FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
               JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
              = ARRAY['provider']::text[]
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
          WHERE x.indrelid = 'public.ai_provider_config'::regclass
            AND x.indisunique AND NOT x.indisprimary
            AND cardinality(c.cols) > 1
            AND ARRAY['provider']::text[] <@ c.cols
        ) INTO near_miss_uq;
      END IF;

      IF wrong_uq OR bad_exact_uq OR near_miss_uq THEN
        incompatible_uniques := array_append(
          incompatible_uniques,
          format('ai_provider_config(expected=provider,same_name_wrong=%s,bad_exact=%s,near_miss=%s)',
            coalesce(wrong_uq::TEXT,'f'), coalesce(bad_exact_uq::TEXT,'f'), coalesce(near_miss_uq::TEXT,'f'))
        );
      ELSIF NOT has_uq THEN
        missing_uniques := array_append(missing_uniques, 'ai_provider_config(provider)');
      END IF;
    END IF;
  END IF;

  -- office_ai_settings UNIQUE(office_id): exact single-column only. Wider/
  -- wrong-order/partial/expression/invalid/not-ready near-miss shapes →
  -- INCOMPATIBLE_UNIQUE (never false READY).
  IF to_regclass('public.office_ai_settings') IS NOT NULL THEN
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='office_ai_settings';
    IF FOUND AND actual_relkind IN ('r','p') THEN
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.office_ai_settings'::regclass AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
          AND pg_get_constraintdef(c.oid) !~* ','
      ) OR EXISTS (
        SELECT 1 FROM pg_index x
        WHERE x.indrelid = 'public.office_ai_settings'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
          AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
               FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
               JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
              = ARRAY['office_id']::text[]
      ) INTO has_uq;

      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.office_ai_settings'::regclass AND c.contype = 'u'
          AND c.conname = 'office_ai_settings_office_id_key'
          AND (
            pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*office_id\s*\)'
            OR pg_get_constraintdef(c.oid) ~* ','
          )
      ) INTO wrong_uq;

      SELECT EXISTS (
        SELECT 1 FROM pg_index x
        WHERE x.indrelid = 'public.office_ai_settings'::regclass
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
          WHERE x.indrelid = 'public.office_ai_settings'::regclass
            AND x.indisunique AND NOT x.indisprimary
            AND cardinality(c.cols) > 1
            AND ARRAY['office_id']::text[] <@ c.cols
        ) INTO near_miss_uq;
      END IF;

      IF wrong_uq OR bad_exact_uq OR near_miss_uq THEN
        incompatible_uniques := array_append(
          incompatible_uniques,
          format('office_ai_settings(expected=office_id,same_name_wrong=%s,bad_exact=%s,near_miss=%s)',
            coalesce(wrong_uq::TEXT,'f'), coalesce(bad_exact_uq::TEXT,'f'), coalesce(near_miss_uq::TEXT,'f'))
        );
      ELSIF NOT has_uq THEN
        missing_uniques := array_append(missing_uniques, 'office_ai_settings(office_id)');
      END IF;
    END IF;
  END IF;

  -- Any blocker wins over every safe repair, including missing tables.
  IF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_uniques)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_UNIQUE'; lock_risk := 'HIGH';
  ELSIF duplicate_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'DUPLICATE_UNIQUE_KEY'; lock_risk := 'HIGH';
  ELSIF null_required_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0
     OR cardinality(missing_uniques)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_COLUMN_DEFAULTS'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'AI_PROVIDER_ENGINE_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx>1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '040_preflight: estimated_rows %',rows_notice;
  RAISE NOTICE '040_preflight: lock_risk=%',lock_risk;
  RAISE NOTICE '040_preflight: null_required_count=% details=%',null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''),empty_text);
  RAISE NOTICE '040_preflight: duplicate_unique_keys=%',
    coalesce(nullif(array_to_string(duplicate_details,','),''),empty_text);
  RAISE NOTICE '040_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''),empty_text);
  RAISE NOTICE '040_preflight: incompatible_pks=% incompatible_uniques=%',
    coalesce(nullif(array_to_string(incompatible_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''),empty_text);
  RAISE NOTICE '040_preflight: missing_tables=%',
    coalesce(nullif(array_to_string(missing_tables,','),''),empty_text);
  RAISE NOTICE '040_preflight: missing_columns=%',coalesce(nullif(array_to_string(missing_columns,','),''),empty_text);
  RAISE NOTICE '040_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''),empty_text);
  RAISE NOTICE '040_preflight: missing_pks=% missing_uniques=%',
    coalesce(nullif(array_to_string(missing_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''),empty_text);
  RAISE NOTICE '040_preflight: chosen_action=% reason_code=%',action,reason_code;

  IF action='BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '040_preflight: BLOCK — do not apply Migration 040 until every blocker is resolved';
    RAISE EXCEPTION '040_preflight: chosen_action=% reason_code=%',action,reason_code;
  ELSIF action='SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '040_preflight: SAFE_AUTO_REPAIR — Migration 040 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '040_preflight: ALREADY_CORRECT — FULL READY (reason_code=AI_PROVIDER_ENGINE_SCHEMA_READY)';
  END IF;
END
$preflight$;
