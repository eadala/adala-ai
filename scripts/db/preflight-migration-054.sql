-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 054 — READ-ONLY checks for Platform Runtime schema
--
-- Owns: ct_security_events / governance_action_log / go_live_certificates /
--       system_audit_logs / engineering_* / prod_* / launch_events /
--       os_events / os_action_queue + Runtime indexes + UNIQUEs.
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 054 preflight: object presence'
SELECT
  to_regclass('public.ct_security_events') IS NOT NULL AS ct_security_events_present,
  to_regclass('public.governance_action_log') IS NOT NULL AS governance_action_log_present,
  to_regclass('public.go_live_certificates') IS NOT NULL AS go_live_certificates_present,
  to_regclass('public.system_audit_logs') IS NOT NULL AS system_audit_logs_present,
  to_regclass('public.engineering_tasks') IS NOT NULL AS engineering_tasks_present,
  to_regclass('public.prod_incidents') IS NOT NULL AS prod_incidents_present,
  to_regclass('public.launch_events') IS NOT NULL AS launch_events_present,
  to_regclass('public.os_events') IS NOT NULL AS os_events_present,
  to_regclass('public.os_action_queue') IS NOT NULL AS os_action_queue_present;

\echo '▶ 054 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY[
    'ct_security_events','governance_action_log','go_live_certificates',
    'system_audit_logs','engineering_tasks','engineering_scans',
    'engineering_ip_whitelist','engineering_logs',
    'prod_incidents','prod_heal_log','launch_events','os_events','os_action_queue'
  ]::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  incompatible_uniques TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];
  duplicate_count BIGINT := 0;

  action TEXT;
  reason_code TEXT;
  tbl TEXT;
  actual_udt TEXT;
  column_spec RECORD;
  idx_spec RECORD;
  idx_table_oid OID;
  actual_table_oid OID;
  index_columns TEXT[];
  index_options INT[];
  desc_ok BOOLEAN;
  opt_i INT;
BEGIN
  FOREACH tbl IN ARRAY owned_tables LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;

  FOR column_spec IN
    SELECT * FROM (VALUES
      ('ct_security_events','event_type','text'),
      ('ct_security_events','severity','text'),
      ('ct_security_events','message','text'),
      ('governance_action_log','action_type','text'),
      ('go_live_certificates','certificate_id','text'),
      ('system_audit_logs','admin_user_id','text'),
      ('engineering_ip_whitelist','ip_address','text'),
      ('launch_events','launched_by','text'),
      ('os_events','event','text')
    ) AS expected_column(table_name,column_name,expected_udt)
  LOOP
    IF to_regclass('public.' || column_spec.table_name) IS NULL THEN CONTINUE; END IF;
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=column_spec.table_name
      AND c.column_name=column_spec.column_name;
    IF actual_udt IS NULL THEN
      missing_columns := array_append(missing_columns,
        format('%s.%s', column_spec.table_name, column_spec.column_name));
    ELSIF actual_udt IS DISTINCT FROM column_spec.expected_udt THEN
      incompatible_types := array_append(incompatible_types,
        format('%s.%s(actual=%s,expected=%s)', column_spec.table_name, column_spec.column_name, actual_udt, column_spec.expected_udt));
    END IF;
  END LOOP;

  FOR idx_spec IN
    SELECT * FROM (VALUES
      ('idx_ct_sec_events_severity','ct_security_events',ARRAY['severity','resolved','created_at']::text[],TRUE),
      ('idx_ct_sec_events_office','ct_security_events',ARRAY['office_id','created_at']::text[],TRUE),
      ('idx_gov_log_created','governance_action_log',ARRAY['created_at']::text[],TRUE),
      ('idx_sys_audit_admin','system_audit_logs',ARRAY['admin_user_id','created_at']::text[],TRUE),
      ('idx_sys_audit_office','system_audit_logs',ARRAY['office_id','created_at']::text[],TRUE)
    ) AS t(index_name, table_name, expected_cols, expect_last_desc)
  LOOP
    idx_table_oid := to_regclass(format('public.%I', idx_spec.table_name));
    SELECT x.indrelid,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality))
    INTO actual_table_oid, index_columns, index_options
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=idx_spec.index_name;

    IF NOT FOUND THEN
      IF idx_table_oid IS NOT NULL THEN
        missing_indexes := array_append(missing_indexes, idx_spec.index_name);
      END IF;
      CONTINUE;
    END IF;

    desc_ok := true;
    IF index_options IS NULL
       OR cardinality(index_options) IS DISTINCT FROM cardinality(idx_spec.expected_cols) THEN
      desc_ok := false;
    ELSE
      FOR opt_i IN 1 .. cardinality(idx_spec.expected_cols) LOOP
        IF opt_i = cardinality(idx_spec.expected_cols) AND idx_spec.expect_last_desc THEN
          IF (index_options[opt_i] & 1) IS DISTINCT FROM 1 THEN desc_ok := false; END IF;
        ELSE
          IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
        END IF;
      END LOOP;
    END IF;

    IF actual_table_oid IS DISTINCT FROM idx_table_oid
       OR index_columns IS DISTINCT FROM idx_spec.expected_cols
       OR desc_ok IS NOT TRUE THEN
      incompatible_indexes := array_append(incompatible_indexes, idx_spec.index_name);
    END IF;
  END LOOP;

  IF to_regclass('public.go_live_certificates') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.go_live_certificates'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*certificate_id\s*\)'
        AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,'
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques, 'go_live_certificates(certificate_id)');
    END IF;
    SELECT COUNT(*) INTO duplicate_count
    FROM (SELECT certificate_id FROM go_live_certificates GROUP BY certificate_id HAVING COUNT(*) > 1) d;
    IF duplicate_count > 0 THEN
      duplicate_details := array_append(duplicate_details, format('certificate_id groups=%s', duplicate_count));
    END IF;
  END IF;

  IF cardinality(incompatible_types) > 0 OR cardinality(incompatible_indexes) > 0
     OR cardinality(incompatible_uniques) > 0 OR cardinality(duplicate_details) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := CASE
      WHEN cardinality(incompatible_types) > 0 THEN 'INCOMPATIBLE_TYPE'
      WHEN cardinality(incompatible_indexes) > 0 THEN 'INCOMPATIBLE_INDEX'
      WHEN cardinality(duplicate_details) > 0 THEN 'DUPLICATE_UNIQUE_KEY'
      ELSE 'INCOMPATIBLE_UNIQUE'
    END;
    RAISE EXCEPTION '054_platform_runtime preflight: % (reason_code=%)', action, reason_code;
  ELSIF cardinality(missing_tables) > 0 OR cardinality(missing_columns) > 0
     OR cardinality(missing_indexes) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := CASE
      WHEN cardinality(missing_tables) > 0 THEN 'TABLE_MISSING'
      WHEN cardinality(missing_indexes) > 0 THEN 'MISSING_INDEXES'
      ELSE 'PARTIAL_SCHEMA'
    END;
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'PLATFORM_RUNTIME_SCHEMA_READY';
  END IF;

  RAISE NOTICE '054 preflight: chosen_action=% reason_code=% missing_tables=% missing_indexes=%',
    action, reason_code, missing_tables, missing_indexes;
END $preflight$;
