-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 053 — READ-ONLY checks for Security Centers schema
-- Owns: security_sessions / security_alerts / blocked_ips / mfa_status_cache
--       audit_coverage_rules / audit_risk_scores
--       compliance_controls / data_requests / retention_policies / legal_holds
--       dr_restore_points / dr_test_runs / dr_health_checks
--       high_risk_op_log / recovery_codes
--       + UNIQUEs + Runtime indexes + proven FK CASCADE
--       + idx_audit_logs_* on already-owned audit_logs (003; skip if table missing)
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 053 preflight: object presence'
SELECT
  to_regclass('public.security_sessions') IS NOT NULL AS security_sessions_present,
  to_regclass('public.security_alerts') IS NOT NULL AS security_alerts_present,
  to_regclass('public.blocked_ips') IS NOT NULL AS blocked_ips_present,
  to_regclass('public.mfa_status_cache') IS NOT NULL AS mfa_status_cache_present,
  to_regclass('public.audit_coverage_rules') IS NOT NULL AS audit_coverage_rules_present,
  to_regclass('public.audit_risk_scores') IS NOT NULL AS audit_risk_scores_present,
  to_regclass('public.compliance_controls') IS NOT NULL AS compliance_controls_present,
  to_regclass('public.data_requests') IS NOT NULL AS data_requests_present,
  to_regclass('public.retention_policies') IS NOT NULL AS retention_policies_present,
  to_regclass('public.legal_holds') IS NOT NULL AS legal_holds_present,
  to_regclass('public.dr_restore_points') IS NOT NULL AS dr_restore_points_present,
  to_regclass('public.dr_test_runs') IS NOT NULL AS dr_test_runs_present,
  to_regclass('public.dr_health_checks') IS NOT NULL AS dr_health_checks_present,
  to_regclass('public.high_risk_op_log') IS NOT NULL AS high_risk_op_log_present,
  to_regclass('public.recovery_codes') IS NOT NULL AS recovery_codes_present,
  to_regclass('public.audit_logs') IS NOT NULL AS audit_logs_present;

\echo '▶ 053 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY[
    'security_sessions','security_alerts','blocked_ips','mfa_status_cache',
    'audit_coverage_rules','audit_risk_scores',
    'compliance_controls','data_requests','retention_policies','legal_holds',
    'dr_restore_points','dr_test_runs','dr_health_checks',
    'high_risk_op_log','recovery_codes'
  ]::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_uniques TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  missing_fks TEXT[] := ARRAY[]::TEXT[];
  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_uniques TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  incompatible_fks TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  orphan_fk_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]::BIGINT[];
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
  cols_ident TEXT;
  null_pred TEXT;
  i INT;

  idx_name TEXT;
  idx_expected_table TEXT;
  idx_expected_cols TEXT[];
  idx_expect_last_desc BOOLEAN;
  idx_skip_if_missing BOOLEAN;
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

  child_attnum INT2;
  ref_attnum INT2;
  orphan_cnt BIGINT;

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
      ('security_sessions','id','uuid',TRUE),
      ('security_sessions','session_id','text',TRUE),
      ('security_sessions','user_id','text',TRUE),
      ('security_alerts','id','uuid',TRUE),
      ('security_alerts','alert_type','text',TRUE),
      ('security_alerts','title','text',TRUE),
      ('blocked_ips','id','uuid',TRUE),
      ('blocked_ips','ip_address','text',TRUE),
      ('mfa_status_cache','user_id','text',TRUE),
      ('audit_coverage_rules','id','uuid',TRUE),
      ('audit_coverage_rules','resource','text',TRUE),
      ('audit_coverage_rules','actions','_text',FALSE),
      ('audit_risk_scores','id','uuid',TRUE),
      ('audit_risk_scores','user_id','text',TRUE),
      ('compliance_controls','id','uuid',TRUE),
      ('compliance_controls','framework','text',TRUE),
      ('compliance_controls','control_id','text',TRUE),
      ('compliance_controls','title','text',TRUE),
      ('data_requests','id','uuid',TRUE),
      ('data_requests','request_type','text',TRUE),
      ('retention_policies','id','uuid',TRUE),
      ('retention_policies','resource_type','text',TRUE),
      ('retention_policies','retention_days','int4',TRUE),
      ('legal_holds','id','uuid',TRUE),
      ('legal_holds','title','text',TRUE),
      ('legal_holds','resources','_text',FALSE),
      ('dr_restore_points','id','uuid',TRUE),
      ('dr_restore_points','label','text',TRUE),
      ('dr_test_runs','id','uuid',TRUE),
      ('dr_test_runs','restore_point_id','uuid',FALSE),
      ('dr_health_checks','id','uuid',TRUE),
      ('dr_health_checks','component','text',TRUE),
      ('high_risk_op_log','id','uuid',TRUE),
      ('high_risk_op_log','operation','text',TRUE),
      ('high_risk_op_log','user_id','text',TRUE),
      ('recovery_codes','id','uuid',TRUE),
      ('recovery_codes','user_id','text',TRUE),
      ('recovery_codes','code_hash','text',TRUE)
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
    IF tbl = 'mfa_status_cache' THEN
      IF pk_cols IS NOT NULL AND pk_cols IS DISTINCT FROM ARRAY['user_id']::TEXT[] THEN
        incompatible_pks := array_append(incompatible_pks, format('%s(actual=%s)', tbl, pk_cols::TEXT));
      ELSIF pk_cols IS NULL THEN
        BEGIN
          EXECUTE format(
            $q$SELECT count(*) FROM (
                 SELECT user_id FROM public.%I WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1
               ) d$q$, tbl) INTO row_count;
        EXCEPTION WHEN undefined_table OR undefined_column THEN row_count := 0;
        END;
        IF row_count > 0 THEN
          incompatible_pks := array_append(incompatible_pks, format('%s(duplicate_user_id_groups=%s)', tbl, row_count));
        ELSE
          missing_pks := array_append(missing_pks, format('%s(user_id)', tbl));
        END IF;
      END IF;
    ELSE
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
    END IF;
  END LOOP;

  FOR tbl_idx IN 1..4 LOOP
    IF tbl_idx = 1 THEN
      uq_table := 'blocked_ips'; uq_expected := ARRAY['ip_address']::TEXT[]; uq_label := 'blocked_ips(ip_address)';
    ELSIF tbl_idx = 2 THEN
      uq_table := 'audit_coverage_rules'; uq_expected := ARRAY['resource']::TEXT[]; uq_label := 'audit_coverage_rules(resource)';
    ELSIF tbl_idx = 3 THEN
      uq_table := 'compliance_controls'; uq_expected := ARRAY['framework','control_id']::TEXT[]; uq_label := 'compliance_controls(framework,control_id)';
    ELSE
      uq_table := 'retention_policies'; uq_expected := ARRAY['resource_type']::TEXT[]; uq_label := 'retention_policies(resource_type)';
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
      cols_ident := '';
      null_pred := '';
      FOR i IN 1..cardinality(uq_expected) LOOP
        IF i > 1 THEN cols_ident := cols_ident || ', '; null_pred := null_pred || ' AND '; END IF;
        cols_ident := cols_ident || quote_ident(uq_expected[i]);
        null_pred := null_pred || quote_ident(uq_expected[i]) || ' IS NOT NULL';
      END LOOP;
      EXECUTE format(
        $q$SELECT COUNT(*) FROM (
             SELECT %s FROM public.%I WHERE %s GROUP BY %s HAVING COUNT(*) > 1
           ) d$q$, cols_ident, uq_table, null_pred, cols_ident)
        INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('%s=%s', uq_label, row_count));
      ELSE
        missing_uniques := array_append(missing_uniques, uq_label);
      END IF;
    END IF;
  END LOOP;

  -- Indexes ALWAYS probed by global name (stolen-name → INCOMPATIBLE_INDEX)
  FOR tbl_idx IN 1..14 LOOP
    IF tbl_idx = 1 THEN
      idx_name := 'idx_security_sessions_user'; idx_expected_table := 'security_sessions';
      idx_expected_cols := ARRAY['user_id']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
    ELSIF tbl_idx = 2 THEN
      idx_name := 'idx_security_sessions_status'; idx_expected_table := 'security_sessions';
      idx_expected_cols := ARRAY['status']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
    ELSIF tbl_idx = 3 THEN
      idx_name := 'idx_security_alerts_status'; idx_expected_table := 'security_alerts';
      idx_expected_cols := ARRAY['status']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
    ELSIF tbl_idx = 4 THEN
      idx_name := 'idx_security_alerts_severity'; idx_expected_table := 'security_alerts';
      idx_expected_cols := ARRAY['severity']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
    ELSIF tbl_idx = 5 THEN
      idx_name := 'idx_blocked_ips_ip'; idx_expected_table := 'blocked_ips';
      idx_expected_cols := ARRAY['ip_address']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
    ELSIF tbl_idx = 6 THEN
      idx_name := 'idx_audit_logs_action'; idx_expected_table := 'audit_logs';
      idx_expected_cols := ARRAY['action']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := TRUE;
    ELSIF tbl_idx = 7 THEN
      idx_name := 'idx_audit_logs_resource'; idx_expected_table := 'audit_logs';
      idx_expected_cols := ARRAY['resource']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := TRUE;
    ELSIF tbl_idx = 8 THEN
      idx_name := 'idx_audit_logs_user_id'; idx_expected_table := 'audit_logs';
      idx_expected_cols := ARRAY['user_id']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := TRUE;
    ELSIF tbl_idx = 9 THEN
      idx_name := 'idx_audit_logs_office_id'; idx_expected_table := 'audit_logs';
      idx_expected_cols := ARRAY['office_id']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := TRUE;
    ELSIF tbl_idx = 10 THEN
      idx_name := 'idx_audit_logs_created_at'; idx_expected_table := 'audit_logs';
      idx_expected_cols := ARRAY['created_at']::TEXT[]; idx_expect_last_desc := TRUE; idx_skip_if_missing := TRUE;
    ELSIF tbl_idx = 11 THEN
      idx_name := 'idx_data_requests_status'; idx_expected_table := 'data_requests';
      idx_expected_cols := ARRAY['status']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
    ELSIF tbl_idx = 12 THEN
      idx_name := 'idx_compliance_controls_framework'; idx_expected_table := 'compliance_controls';
      idx_expected_cols := ARRAY['framework']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
    ELSIF tbl_idx = 13 THEN
      idx_name := 'idx_high_risk_op_user'; idx_expected_table := 'high_risk_op_log';
      idx_expected_cols := ARRAY['user_id']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
    ELSE
      idx_name := 'idx_recovery_codes_user'; idx_expected_table := 'recovery_codes';
      idx_expected_cols := ARRAY['user_id']::TEXT[]; idx_expect_last_desc := FALSE; idx_skip_if_missing := FALSE;
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
      IF idx_skip_if_missing AND to_regclass(format('public.%I', idx_expected_table)) IS NULL THEN
        NULL;
      ELSE
        missing_indexes := array_append(missing_indexes, idx_name);
      END IF;
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

  -- Proven FK CASCADE; parent-missing + child rows → ORPHAN_FK (never TABLE_MISSING SAFE)
  IF to_regclass('public.dr_test_runs') IS NOT NULL THEN
    IF to_regclass('public.dr_restore_points') IS NULL THEN
      SELECT COUNT(*) INTO orphan_cnt FROM dr_test_runs WHERE restore_point_id IS NOT NULL;
      IF orphan_cnt > 0 THEN
        orphan_fk_details := array_append(orphan_fk_details,
          format('dr_test_runs.rows=%s dr_restore_points=missing', orphan_cnt));
      END IF;
    ELSE
      SELECT a.attnum INTO child_attnum
      FROM pg_attribute a
      WHERE a.attrelid='public.dr_test_runs'::regclass
        AND a.attname='restore_point_id' AND NOT a.attisdropped;
      SELECT a.attnum INTO ref_attnum
      FROM pg_attribute a
      WHERE a.attrelid='public.dr_restore_points'::regclass
        AND a.attname='id' AND NOT a.attisdropped;

      IF EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid='public.dr_test_runs'::regclass
          AND c.contype='f' AND c.conname='dr_test_runs_restore_point_id_fkey'
          AND NOT (
            c.confrelid='public.dr_restore_points'::regclass
            AND c.confdeltype='c'
            AND array_length(c.conkey, 1)=1 AND c.conkey[1]=child_attnum
            AND array_length(c.confkey, 1)=1 AND c.confkey[1]=ref_attnum
          )
      ) THEN
        incompatible_fks := array_append(incompatible_fks, 'dr_test_runs_restore_point_id_fkey(wrong_shape)');
      END IF;

      SELECT COUNT(*) INTO orphan_cnt FROM dr_test_runs r
      WHERE r.restore_point_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM dr_restore_points p WHERE p.id=r.restore_point_id);
      IF orphan_cnt > 0 THEN
        orphan_fk_details := array_append(orphan_fk_details, format('dr_test_runs.orphan_restore_point_id=%s', orphan_cnt));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid='public.dr_test_runs'::regclass
          AND c.contype='f' AND c.conname='dr_test_runs_restore_point_id_fkey'
          AND c.confrelid='public.dr_restore_points'::regclass
          AND c.confdeltype='c'
      ) THEN
        missing_fks := array_append(missing_fks, 'dr_test_runs_restore_point_id_fkey');
      END IF;
    END IF;
  END IF;

  -- Any blocker wins over every safe repair
  IF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_uniques)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_UNIQUE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_fks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_FK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_INDEX'; lock_risk := 'HIGH';
  ELSIF duplicate_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'DUPLICATE_UNIQUE_KEY'; lock_risk := 'HIGH';
  ELSIF null_required_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF cardinality(orphan_fk_details)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'ORPHAN_FK'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0 OR cardinality(missing_uniques)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_fks)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_FKS'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_indexes)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_INDEXES'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'SECURITY_CENTERS_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx > 1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '053_preflight: estimated_rows %', rows_notice;
  RAISE NOTICE '053_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '053_preflight: null_required_count=% details=%', null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''), empty_text);
  RAISE NOTICE '053_preflight: incompatible_objects=% incompatible_types=% incompatible_pks=% incompatible_uniques=% incompatible_indexes=% incompatible_fks=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes,','),''), empty_text),
    coalesce(nullif(array_to_string(incompatible_fks,','),''), empty_text);
  RAISE NOTICE '053_preflight: orphan_fk=%',
    coalesce(nullif(array_to_string(orphan_fk_details,','),''), empty_text);
  RAISE NOTICE '053_preflight: missing_tables=% missing_columns=% missing_pks=% missing_uniques=% missing_indexes=% missing_not_null=% missing_fks=%',
    coalesce(nullif(array_to_string(missing_tables,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_columns,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_pks,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_indexes,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''), empty_text),
    coalesce(nullif(array_to_string(missing_fks,','),''), empty_text);
  RAISE NOTICE '053_preflight: duplicate_unique_keys=% details=%',
    duplicate_count, coalesce(nullif(array_to_string(duplicate_details,','),''), empty_text);
  RAISE NOTICE '053_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE EXCEPTION '053_preflight: BLOCK_AND_MANUAL_REVIEW (reason_code=%)', reason_code;
  END IF;
END
$preflight$;
