-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 056 — READ-ONLY RLS Runtime schema
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 056 preflight: supporting tables + cases RLS'
SELECT
  to_regclass('public.security_events') IS NOT NULL AS security_events_present,
  to_regclass('public.rls_enablement_log') IS NOT NULL AS rls_enablement_log_present,
  (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='cases') AS cases_rls,
  (SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='cases') AS cases_force;

\echo '▶ 056 preflight: full contract and decision'
DO $preflight$
DECLARE
  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  missing_policies TEXT[] := ARRAY[]::TEXT[];
  incompatible_policies TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  rls_not_enabled TEXT[] := ARRAY[]::TEXT[];
  force_not_set TEXT[] := ARRAY[]::TEXT[];

  action TEXT;
  reason_code TEXT;
  cases_rls BOOLEAN;
  cases_force BOOLEAN;
  zta_qual TEXT;
  vault_qual TEXT;
  idx_spec RECORD;
  actual_table_oid OID;
  index_columns TEXT[];
  index_options INT[];
  desc_ok BOOLEAN;
  opt_i INT;
BEGIN
  IF to_regclass('public.security_events') IS NULL THEN
    missing_tables := array_append(missing_tables, 'security_events');
  END IF;
  IF to_regclass('public.rls_enablement_log') IS NULL THEN
    missing_tables := array_append(missing_tables, 'rls_enablement_log');
  END IF;

  IF to_regclass('public.cases') IS NOT NULL THEN
    SELECT c.relrowsecurity, c.relforcerowsecurity INTO cases_rls, cases_force
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='cases';
    IF cases_rls IS NOT TRUE THEN
      rls_not_enabled := array_append(rls_not_enabled, 'cases');
    END IF;
    IF cases_force IS NOT TRUE THEN
      force_not_set := array_append(force_not_set, 'cases');
    END IF;

    SELECT p.qual INTO zta_qual FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename='cases'
      AND p.policyname='zta_tenant_isolation_cases';
    IF zta_qual IS NULL THEN
      missing_policies := array_append(missing_policies, 'zta_tenant_isolation_cases');
    ELSIF zta_qual !~* 'office_id' OR zta_qual !~* 'current_setting' THEN
      incompatible_policies := array_append(incompatible_policies, 'zta_tenant_isolation_cases');
    END IF;

    SELECT p.qual INTO vault_qual FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename='cases'
      AND p.policyname='vault_tenant_isolation';
    IF vault_qual IS NULL THEN
      missing_policies := array_append(missing_policies, 'vault_tenant_isolation@cases');
    ELSIF vault_qual !~* 'adala_tenant_ok'
          AND (vault_qual !~* 'current_setting' OR vault_qual !~* 'bypass_rls') THEN
      incompatible_policies := array_append(incompatible_policies, 'vault_tenant_isolation@cases');
    END IF;
  END IF;

  FOR idx_spec IN
    SELECT * FROM (VALUES
      ('idx_security_events_type','security_events',ARRAY['event_type']::text[],FALSE),
      ('idx_security_events_created','security_events',ARRAY['created_at']::text[],TRUE),
      ('idx_security_events_office','security_events',ARRAY['office_id']::text[],FALSE)
    ) AS t(index_name, table_name, expected_cols, expect_last_desc)
  LOOP
    IF to_regclass(format('public.%I', idx_spec.table_name)) IS NULL THEN CONTINUE; END IF;
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
      missing_indexes := array_append(missing_indexes, idx_spec.index_name);
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

    IF actual_table_oid IS DISTINCT FROM to_regclass(format('public.%I', idx_spec.table_name))
       OR index_columns IS DISTINCT FROM idx_spec.expected_cols
       OR desc_ok IS NOT TRUE THEN
      incompatible_indexes := array_append(incompatible_indexes, idx_spec.index_name);
    END IF;
  END LOOP;

  IF cardinality(incompatible_policies) > 0 OR cardinality(incompatible_indexes) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := CASE
      WHEN cardinality(incompatible_policies) > 0 THEN 'INCOMPATIBLE_POLICY'
      ELSE 'INCOMPATIBLE_INDEX'
    END;
    RAISE EXCEPTION '056_rls preflight: % (reason_code=%)', action, reason_code;
  ELSIF cardinality(missing_tables) > 0 OR cardinality(missing_indexes) > 0
     OR cardinality(missing_policies) > 0
     OR cardinality(rls_not_enabled) > 0 OR cardinality(force_not_set) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := CASE
      WHEN cardinality(missing_tables) > 0 THEN 'TABLE_MISSING'
      WHEN cardinality(missing_policies) > 0 THEN 'MISSING_POLICIES'
      WHEN cardinality(rls_not_enabled) > 0 THEN 'RLS_NOT_ENABLED'
      WHEN cardinality(force_not_set) > 0 THEN 'FORCE_NOT_SET'
      ELSE 'MISSING_INDEXES'
    END;
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'RLS_RUNTIME_SCHEMA_READY';
  END IF;

  RAISE NOTICE '056 preflight: chosen_action=% reason_code=% missing_tables=% missing_policies=%',
    action, reason_code, missing_tables, missing_policies;
END $preflight$;
