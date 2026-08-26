-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 055 — READ-ONLY Platform Runtime batch 2 schema
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 055 preflight: object presence'
SELECT
  to_regclass('public.developer_impersonation') IS NOT NULL AS developer_impersonation_present,
  to_regclass('public.tenant_audit_logs') IS NOT NULL AS tenant_audit_logs_present,
  to_regclass('public.platform_integrations') IS NOT NULL AS platform_integrations_present,
  to_regclass('public.tenant_bindings') IS NOT NULL AS tenant_bindings_present,
  to_regclass('public.tenant_audit_archive') IS NOT NULL AS tenant_audit_archive_present;

\echo '▶ 055 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY[
    'developer_impersonation','ghost_access_log','developer_accounts',
    'tenant_audit_logs','office_isolation_config','organization_units',
    'platform_integrations','office_integration_status','integration_requests',
    'demo_sync_log','pcc_command_log','office_themes',
    'tenant_bindings','tenant_binding_history','tenant_audit_archive'
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
      ('developer_impersonation','super_admin_user_id','text'),
      ('developer_accounts','email','text'),
      ('tenant_audit_logs','user_id','text'),
      ('office_isolation_config','office_id','text'),
      ('platform_integrations','key','text'),
      ('office_integration_status','office_id','text'),
      ('tenant_bindings','user_id','text'),
      ('office_themes','tokens','jsonb')
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
        format('%s.%s', column_spec.table_name, column_spec.column_name));
    END IF;
  END LOOP;

  FOR idx_spec IN
    SELECT * FROM (VALUES
      ('idx_tenant_audit_user','tenant_audit_logs',ARRAY['user_id']::text[],FALSE),
      ('idx_tenant_audit_time','tenant_audit_logs',ARRAY['created_at']::text[],TRUE),
      ('idx_tenant_audit_source','tenant_audit_logs',ARRAY['source']::text[],FALSE),
      ('idx_ois_office','office_integration_status',ARRAY['office_id']::text[],FALSE),
      ('idx_ir_status','integration_requests',ARRAY['status','created_at']::text[],TRUE),
      ('idx_tb_user','tenant_bindings',ARRAY['user_id']::text[],FALSE),
      ('idx_tbh_user','tenant_binding_history',ARRAY['user_id']::text[],FALSE),
      ('idx_tbh_version','tenant_binding_history',ARRAY['user_id','version']::text[],TRUE),
      ('idx_taa_tenant_period','tenant_audit_archive',ARRAY['tenant_id','period']::text[],FALSE)
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

  IF to_regclass('public.developer_impersonation') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.developer_impersonation'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*super_admin_user_id\s*\)'
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques, 'developer_impersonation(super_admin_user_id)');
    END IF;
  END IF;

  IF to_regclass('public.developer_accounts') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.developer_accounts'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*email\s*\)'
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques, 'developer_accounts(email)');
    END IF;
    SELECT COUNT(*) INTO duplicate_count
    FROM (SELECT email FROM developer_accounts GROUP BY email HAVING COUNT(*) > 1) d;
    IF duplicate_count > 0 THEN
      duplicate_details := array_append(duplicate_details, format('developer_accounts.email groups=%s', duplicate_count));
    END IF;
  END IF;

  IF to_regclass('public.office_integration_status') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.office_integration_status'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*,\s*integration_key\s*\)'
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques, 'office_integration_status(office_id, integration_key)');
    END IF;
  END IF;

  IF to_regclass('public.tenant_bindings') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.tenant_bindings'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*user_id\s*\)'
    ) THEN
      incompatible_uniques := array_append(incompatible_uniques, 'tenant_bindings(user_id)');
    END IF;
  END IF;

  IF to_regclass('public.tenant_audit_archive') IS NOT NULL THEN
    IF to_regclass('public.idx_taa_tenant_period') IS NULL THEN
      incompatible_uniques := array_append(incompatible_uniques, 'idx_taa_tenant_period missing');
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
    RAISE EXCEPTION '055_platform_runtime_b2 preflight: % (reason_code=%)', action, reason_code;
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
    reason_code := 'PLATFORM_RUNTIME_B2_SCHEMA_READY';
  END IF;

  RAISE NOTICE '055 preflight: chosen_action=% reason_code=% missing_tables=% missing_indexes=%',
    action, reason_code, missing_tables, missing_indexes;
END $preflight$;
