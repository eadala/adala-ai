-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 034 — READ-ONLY checks for JLWM Core schema
--
-- This script only reads catalogs/data and emits notices. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Strict decision ladder:
--   1. Inspect every present 034-owned object (all 14 tables).
--   2. Collect blockers across all present objects.
--   3. Any blocker wins over every safe repair, including missing tables.
--   4. With no blockers, report SAFE_AUTO_REPAIR for any contract gap;
--      otherwise report ALREADY_CORRECT only when fully ready.
--
-- Safe when ALL 14 tables are absent (TABLE_MISSING → SAFE_AUTO_REPAIR).
-- FK readiness taxonomy (fk_status is authoritative detail):
--   FULL READY:
--     ALREADY_CORRECT + reason_code=JLWM_CORE_SCHEMA_READY
--     ONLY when fk_status=INSTALLED and the rest of the 14-table contract is correct.
--   LEGACY SAFE BUT FK DEFERRED / PENDING:
--     SAFE_AUTO_REPAIR + reason_code=READY_WITH_DEFERRED_FK
--     when fk_status is DEFERRED* or PENDING (never ALREADY_CORRECT).
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 034 preflight: object presence'
SELECT
  to_regclass('public.jlwm_config') IS NOT NULL AS jlwm_config_present,
  to_regclass('public.jlwm_memory_nodes') IS NOT NULL AS jlwm_memory_nodes_present,
  to_regclass('public.jlwm_memory_edges') IS NOT NULL AS jlwm_memory_edges_present,
  to_regclass('public.jlwm_world_states') IS NOT NULL AS jlwm_world_states_present,
  to_regclass('public.jlwm_legal_patterns') IS NOT NULL AS jlwm_legal_patterns_present,
  to_regclass('public.jlwm_command_sessions') IS NOT NULL AS jlwm_command_sessions_present,
  to_regclass('public.jlwm_command_actions') IS NOT NULL AS jlwm_command_actions_present,
  to_regclass('public.jlwm_case_twins') IS NOT NULL AS jlwm_case_twins_present,
  to_regclass('public.jlwm_client_twins') IS NOT NULL AS jlwm_client_twins_present,
  to_regclass('public.jlwm_firm_twin') IS NOT NULL AS jlwm_firm_twin_present,
  to_regclass('public.jlwm_predictions') IS NOT NULL AS jlwm_predictions_present,
  to_regclass('public.jlwm_recommendations') IS NOT NULL AS jlwm_recommendations_present,
  to_regclass('public.jlwm_radar_alerts') IS NOT NULL AS jlwm_radar_alerts_present,
  to_regclass('public.jlwm_feedback') IS NOT NULL AS jlwm_feedback_present;

\echo '▶ 034 preflight: full contract and decision'
DO $preflight$
DECLARE
  uuid_re CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  owned_tables CONSTANT TEXT[] := ARRAY[
    'jlwm_config','jlwm_memory_nodes','jlwm_memory_edges','jlwm_world_states',
    'jlwm_legal_patterns','jlwm_command_sessions','jlwm_command_actions',
    'jlwm_case_twins','jlwm_client_twins','jlwm_firm_twin','jlwm_predictions',
    'jlwm_recommendations','jlwm_radar_alerts','jlwm_feedback'
  ]::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_defaults TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_unique TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  missing_fk BOOLEAN := false;

  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_unique TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  null_office_details TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  non_uuid_details TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];

  table_present BOOLEAN[] := ARRAY[
    false,false,false,false,false,false,false,false,false,false,false,false,false,false
  ]::BOOLEAN[];
  estimated_rows BIGINT[] := ARRAY[
    0,0,0,0,0,0,0,0,0,0,0,0,0,0
  ]::BIGINT[];

  null_office_count BIGINT := 0;
  null_required_count BIGINT := 0;
  non_uuid_count BIGINT := 0;
  dup_config BIGINT := 0;
  dup_case BIGINT := 0;
  dup_client BIGINT := 0;
  dup_firm BIGINT := 0;
  dup_memory BIGINT := 0;
  orphan_from BIGINT := 0;
  orphan_to BIGINT := 0;
  fk_from BOOLEAN := false;
  fk_to BOOLEAN := false;
  fk_status TEXT := 'N/A';

  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'LOW';

  table_spec RECORD;
  column_spec RECORD;
  unique_spec RECORD;
  index_spec RECORD;
  tbl TEXT;
  tbl_idx INT;
  actual_relkind "char";
  actual_udt TEXT;
  actual_nullable TEXT;
  actual_default TEXT;
  normalized_default TEXT;
  row_count BIGINT;
  group_count BIGINT;
  pk_exists BOOLEAN;
  pk_cols TEXT[];
  has_unique BOOLEAN;
  wrong_unique BOOLEAN;
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
  pred_sql TEXT;
  pred_norm TEXT;
  expected_table_oid OID;
  actual_table_oid OID;

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
      -- config
      ('jlwm_config','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_config','office_id','text',TRUE,NULL,NULL),
      ('jlwm_config','enabled','bool',TRUE,'literal','true'),
      ('jlwm_config','enabled_modules','_text',TRUE,'array_default',NULL),
      ('jlwm_config','sync_frequency','text',TRUE,'literal','hourly'),
      ('jlwm_config','ai_model','text',TRUE,'literal','gemini'),
      ('jlwm_config','last_full_sync_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_config','created_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_config','updated_at','timestamptz',TRUE,'now',NULL),
      -- memory_nodes
      ('jlwm_memory_nodes','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_memory_nodes','office_id','text',TRUE,NULL,NULL),
      ('jlwm_memory_nodes','node_type','text',TRUE,NULL,NULL),
      ('jlwm_memory_nodes','node_ref','text',FALSE,NULL,NULL),
      ('jlwm_memory_nodes','label','text',TRUE,NULL,NULL),
      ('jlwm_memory_nodes','properties','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_memory_nodes','importance_score','float8',TRUE,'literal','0.5'),
      ('jlwm_memory_nodes','is_auto','bool',TRUE,'literal','true'),
      ('jlwm_memory_nodes','created_at','timestamptz',TRUE,'now',NULL),
      ('jlwm_memory_nodes','updated_at','timestamptz',TRUE,'now',NULL),
      -- memory_edges
      ('jlwm_memory_edges','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_memory_edges','office_id','text',TRUE,NULL,NULL),
      ('jlwm_memory_edges','from_node_id','text',TRUE,NULL,NULL),
      ('jlwm_memory_edges','to_node_id','text',TRUE,NULL,NULL),
      ('jlwm_memory_edges','edge_type','text',TRUE,NULL,NULL),
      ('jlwm_memory_edges','weight','float8',TRUE,'literal','0.5'),
      ('jlwm_memory_edges','evidence','jsonb',TRUE,'jsonb_obj',NULL),
      ('jlwm_memory_edges','created_at','timestamptz',TRUE,'now',NULL),
      -- world_states (office_id is the SET NOT NULL target for repaired tables)
      ('jlwm_world_states','id','text',FALSE,'uuid_text',NULL),
      ('jlwm_world_states','office_id','text',TRUE,NULL,NULL),
      ('jlwm_world_states','risk_level','text',FALSE,'literal','green'),
      ('jlwm_world_states','state_vector','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_world_states','active_threats','jsonb',FALSE,'jsonb_arr',NULL),
      ('jlwm_world_states','opportunities','jsonb',FALSE,'jsonb_arr',NULL),
      ('jlwm_world_states','state_summary','text',FALSE,NULL,NULL),
      ('jlwm_world_states','computed_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_world_states','valid_until','timestamptz',FALSE,'any_default',NULL),
      ('jlwm_world_states','triggered_by','text',FALSE,'literal','auto'),
      -- legal_patterns
      ('jlwm_legal_patterns','id','text',FALSE,'uuid_text',NULL),
      ('jlwm_legal_patterns','office_id','text',TRUE,NULL,NULL),
      ('jlwm_legal_patterns','pattern_type','text',FALSE,NULL,NULL),
      ('jlwm_legal_patterns','pattern_name','text',FALSE,NULL,NULL),
      ('jlwm_legal_patterns','description','text',FALSE,NULL,NULL),
      ('jlwm_legal_patterns','evidence_count','int4',FALSE,'literal','1'),
      ('jlwm_legal_patterns','confidence_score','float8',FALSE,'literal','0.5'),
      ('jlwm_legal_patterns','applies_to','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_legal_patterns','is_active','bool',FALSE,'literal','true'),
      ('jlwm_legal_patterns','first_seen_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_legal_patterns','last_seen_at','timestamptz',FALSE,'now',NULL),
      -- command_sessions
      ('jlwm_command_sessions','id','text',FALSE,'uuid_text',NULL),
      ('jlwm_command_sessions','office_id','text',TRUE,NULL,NULL),
      ('jlwm_command_sessions','user_id','text',FALSE,NULL,NULL),
      ('jlwm_command_sessions','query','text',FALSE,NULL,NULL),
      ('jlwm_command_sessions','response','text',FALSE,NULL,NULL),
      ('jlwm_command_sessions','context_used','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_command_sessions','model_used','text',FALSE,NULL,NULL),
      ('jlwm_command_sessions','tokens_est','int4',FALSE,'literal','0'),
      ('jlwm_command_sessions','duration_ms','int4',FALSE,NULL,NULL),
      ('jlwm_command_sessions','status','text',FALSE,'literal','pending'),
      ('jlwm_command_sessions','created_at','timestamptz',FALSE,'now',NULL),
      -- command_actions
      ('jlwm_command_actions','id','text',FALSE,'uuid_text',NULL),
      ('jlwm_command_actions','office_id','text',TRUE,NULL,NULL),
      ('jlwm_command_actions','user_id','text',FALSE,NULL,NULL),
      ('jlwm_command_actions','action_type','text',FALSE,NULL,NULL),
      ('jlwm_command_actions','status','text',FALSE,'literal','pending'),
      ('jlwm_command_actions','result','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_command_actions','error_msg','text',FALSE,NULL,NULL),
      ('jlwm_command_actions','started_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_command_actions','finished_at','timestamptz',FALSE,NULL,NULL),
      -- case_twins
      ('jlwm_case_twins','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_case_twins','office_id','text',TRUE,NULL,NULL),
      ('jlwm_case_twins','case_id','text',TRUE,NULL,NULL),
      ('jlwm_case_twins','health_score','float8',FALSE,'literal','50'),
      ('jlwm_case_twins','complexity_score','float8',FALSE,'literal','50'),
      ('jlwm_case_twins','risk_level','text',FALSE,'literal','medium'),
      ('jlwm_case_twins','predicted_outcome','text',FALSE,NULL,NULL),
      ('jlwm_case_twins','outcome_confidence','float8',FALSE,'literal','0'),
      ('jlwm_case_twins','predicted_duration_days','int4',FALSE,NULL,NULL),
      ('jlwm_case_twins','financial_exposure','float8',FALSE,'literal','0'),
      ('jlwm_case_twins','key_entities','jsonb',FALSE,'jsonb_arr',NULL),
      ('jlwm_case_twins','critical_dates','jsonb',FALSE,'jsonb_arr',NULL),
      ('jlwm_case_twins','strengths','_text',FALSE,'array_default',NULL),
      ('jlwm_case_twins','weaknesses','_text',FALSE,'array_default',NULL),
      ('jlwm_case_twins','opportunities','_text',FALSE,'array_default',NULL),
      ('jlwm_case_twins','state_data','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_case_twins','last_synced_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_case_twins','created_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_case_twins','updated_at','timestamptz',FALSE,'now',NULL),
      -- client_twins
      ('jlwm_client_twins','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_client_twins','office_id','text',TRUE,NULL,NULL),
      ('jlwm_client_twins','client_id','text',TRUE,NULL,NULL),
      ('jlwm_client_twins','loyalty_score','float8',FALSE,'literal','50'),
      ('jlwm_client_twins','risk_score','float8',FALSE,'literal','50'),
      ('jlwm_client_twins','ltv_score','float8',FALSE,'literal','0'),
      ('jlwm_client_twins','total_cases','int4',FALSE,'literal','0'),
      ('jlwm_client_twins','won_cases','int4',FALSE,'literal','0'),
      ('jlwm_client_twins','lost_cases','int4',FALSE,'literal','0'),
      ('jlwm_client_twins','active_cases','int4',FALSE,'literal','0'),
      ('jlwm_client_twins','total_invoiced','float8',FALSE,'literal','0'),
      ('jlwm_client_twins','total_paid','float8',FALSE,'literal','0'),
      ('jlwm_client_twins','payment_reliability','float8',FALSE,'literal','1'),
      ('jlwm_client_twins','churn_risk','text',FALSE,'literal','low'),
      ('jlwm_client_twins','predicted_next_case','timestamptz',FALSE,NULL,NULL),
      ('jlwm_client_twins','behavioral_patterns','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_client_twins','last_synced_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_client_twins','created_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_client_twins','updated_at','timestamptz',FALSE,'now',NULL),
      -- firm_twin
      ('jlwm_firm_twin','id','text',TRUE,'uuid_text',NULL),
      ('jlwm_firm_twin','office_id','text',TRUE,NULL,NULL),
      ('jlwm_firm_twin','performance_score','float8',FALSE,'literal','50'),
      ('jlwm_firm_twin','efficiency_score','float8',FALSE,'literal','50'),
      ('jlwm_firm_twin','health_score','float8',FALSE,'literal','50'),
      ('jlwm_firm_twin','monthly_revenue','float8',FALSE,'literal','0'),
      ('jlwm_firm_twin','revenue_trend','float8',FALSE,'literal','0'),
      ('jlwm_firm_twin','active_cases_count','int4',FALSE,'literal','0'),
      ('jlwm_firm_twin','avg_case_duration_days','float8',FALSE,'literal','0'),
      ('jlwm_firm_twin','win_rate_pct','float8',FALSE,'literal','0'),
      ('jlwm_firm_twin','client_satisfaction','float8',FALSE,'literal','50'),
      ('jlwm_firm_twin','top_case_types','jsonb',FALSE,'jsonb_arr',NULL),
      ('jlwm_firm_twin','resource_utilization','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_firm_twin','financial_health','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_firm_twin','growth_indicators','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_firm_twin','snapshot_date','date',TRUE,'any_default',NULL),
      ('jlwm_firm_twin','created_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_firm_twin','updated_at','timestamptz',FALSE,'now',NULL),
      -- predictions
      ('jlwm_predictions','id','text',FALSE,'uuid_text',NULL),
      ('jlwm_predictions','office_id','text',TRUE,NULL,NULL),
      ('jlwm_predictions','subject_type','text',FALSE,NULL,NULL),
      ('jlwm_predictions','subject_id','text',FALSE,NULL,NULL),
      ('jlwm_predictions','prediction_type','text',FALSE,NULL,NULL),
      ('jlwm_predictions','predicted_value','text',FALSE,NULL,NULL),
      ('jlwm_predictions','confidence_score','float8',FALSE,'literal','0'),
      ('jlwm_predictions','supporting_data','jsonb',FALSE,'jsonb_obj',NULL),
      ('jlwm_predictions','model_used','text',FALSE,NULL,NULL),
      ('jlwm_predictions','is_verified','bool',FALSE,'literal','false'),
      ('jlwm_predictions','actual_value','text',FALSE,NULL,NULL),
      ('jlwm_predictions','expires_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_predictions','created_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_predictions','updated_at','timestamptz',FALSE,'now',NULL),
      -- recommendations
      ('jlwm_recommendations','id','text',FALSE,'uuid_text',NULL),
      ('jlwm_recommendations','office_id','text',TRUE,NULL,NULL),
      ('jlwm_recommendations','target_type','text',FALSE,'literal','firm'),
      ('jlwm_recommendations','target_id','text',FALSE,NULL,NULL),
      ('jlwm_recommendations','category','text',FALSE,NULL,NULL),
      ('jlwm_recommendations','priority','text',FALSE,'literal','medium'),
      ('jlwm_recommendations','title','text',FALSE,NULL,NULL),
      ('jlwm_recommendations','body','text',FALSE,NULL,NULL),
      ('jlwm_recommendations','action_items','jsonb',FALSE,'jsonb_arr',NULL),
      ('jlwm_recommendations','estimated_impact','text',FALSE,NULL,NULL),
      ('jlwm_recommendations','is_read','bool',FALSE,'literal','false'),
      ('jlwm_recommendations','is_applied','bool',FALSE,'literal','false'),
      ('jlwm_recommendations','dismissed','bool',FALSE,'literal','false'),
      ('jlwm_recommendations','expires_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_recommendations','created_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_recommendations','updated_at','timestamptz',FALSE,'now',NULL),
      -- radar_alerts
      ('jlwm_radar_alerts','id','text',FALSE,'uuid_text',NULL),
      ('jlwm_radar_alerts','office_id','text',TRUE,NULL,NULL),
      ('jlwm_radar_alerts','alert_type','text',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','severity','text',FALSE,'literal','warning'),
      ('jlwm_radar_alerts','subject_type','text',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','subject_id','text',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','title','text',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','body','text',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','action_url','text',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','is_acknowledged','bool',FALSE,'literal','false'),
      ('jlwm_radar_alerts','acknowledged_by','text',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','acknowledged_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','auto_resolved','bool',FALSE,'literal','false'),
      ('jlwm_radar_alerts','resolved_at','timestamptz',FALSE,NULL,NULL),
      ('jlwm_radar_alerts','created_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_radar_alerts','updated_at','timestamptz',FALSE,'now',NULL),
      -- feedback
      ('jlwm_feedback','id','text',FALSE,'uuid_text',NULL),
      ('jlwm_feedback','office_id','text',TRUE,NULL,NULL),
      ('jlwm_feedback','user_id','text',FALSE,NULL,NULL),
      ('jlwm_feedback','source_type','text',FALSE,NULL,NULL),
      ('jlwm_feedback','source_id','text',FALSE,NULL,NULL),
      ('jlwm_feedback','rating','int4',FALSE,NULL,NULL),
      ('jlwm_feedback','was_accurate','bool',FALSE,NULL,NULL),
      ('jlwm_feedback','was_useful','bool',FALSE,NULL,NULL),
      ('jlwm_feedback','user_action','text',FALSE,NULL,NULL),
      ('jlwm_feedback','notes','text',FALSE,NULL,NULL),
      ('jlwm_feedback','created_at','timestamptz',FALSE,'now',NULL),
      ('jlwm_feedback','updated_at','timestamptz',FALSE,'now',NULL)
    ) AS expected_column(
      table_name, column_name, expected_udt, required_not_null, default_kind, expected_default
    )
  LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = column_spec.table_name;
    IF NOT FOUND OR actual_relkind NOT IN ('r', 'p') THEN
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
    ELSIF column_spec.default_kind = 'array_default' THEN
      IF actual_default IS NULL OR (
           actual_default NOT ILIKE '%ARRAY%'
           AND actual_default NOT ILIKE '%{}%'
         ) THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected=array_default,actual=%s)',
            column_spec.table_name, column_spec.column_name,
            coalesce(actual_default, '<none>'))
        );
      END IF;
    ELSIF column_spec.default_kind = 'any_default' THEN
      IF actual_default IS NULL THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected=<any_default>,actual=<none>)',
            column_spec.table_name, column_spec.column_name)
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

  /* ── 4) Duplicate UNIQUE arbiters (data-level) ────────────────────────── */
  IF table_present[1] AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_config' AND column_name='office_id'
  ) THEN
    SELECT count(*) INTO dup_config FROM (
      SELECT office_id FROM public.jlwm_config
      WHERE office_id IS NOT NULL
      GROUP BY office_id HAVING count(*) > 1
    ) d;
    IF dup_config > 0 THEN
      duplicate_details := array_append(duplicate_details, format('config_office_id=%s', dup_config));
    END IF;
  END IF;

  IF table_present[8] AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_case_twins' AND column_name='case_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_case_twins' AND column_name='office_id'
  ) THEN
    SELECT count(*) INTO dup_case FROM (
      SELECT office_id, case_id FROM public.jlwm_case_twins
      GROUP BY office_id, case_id HAVING count(*) > 1
    ) d;
    IF dup_case > 0 THEN
      duplicate_details := array_append(duplicate_details, format('case_twin=%s', dup_case));
    END IF;
  END IF;

  IF table_present[9] AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_client_twins' AND column_name='client_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_client_twins' AND column_name='office_id'
  ) THEN
    SELECT count(*) INTO dup_client FROM (
      SELECT office_id, client_id FROM public.jlwm_client_twins
      GROUP BY office_id, client_id HAVING count(*) > 1
    ) d;
    IF dup_client > 0 THEN
      duplicate_details := array_append(duplicate_details, format('client_twin=%s', dup_client));
    END IF;
  END IF;

  IF table_present[10] AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_firm_twin' AND column_name='snapshot_date'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_firm_twin' AND column_name='office_id'
  ) THEN
    SELECT count(*) INTO dup_firm FROM (
      SELECT office_id, snapshot_date FROM public.jlwm_firm_twin
      GROUP BY office_id, snapshot_date HAVING count(*) > 1
    ) d;
    IF dup_firm > 0 THEN
      duplicate_details := array_append(duplicate_details, format('firm_twin=%s', dup_firm));
    END IF;
  END IF;

  IF table_present[2] AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_memory_nodes' AND column_name='node_ref'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_memory_nodes' AND column_name='node_type'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jlwm_memory_nodes' AND column_name='office_id'
  ) THEN
    SELECT count(*) INTO dup_memory FROM (
      SELECT office_id, node_type, node_ref
      FROM public.jlwm_memory_nodes
      WHERE node_ref IS NOT NULL
      GROUP BY office_id, node_type, node_ref
      HAVING count(*) > 1
    ) d;
    IF dup_memory > 0 THEN
      duplicate_details := array_append(duplicate_details, format('memory_node=%s', dup_memory));
    END IF;
  END IF;

  /* ── 5) PRIMARY KEY (id) on every present table ───────────────────────── */
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

  /* ── 6) UNIQUE arbiters (constraint or equivalent unique index) ───────── */
  /* jlwm_config UNIQUE(office_id) */
  IF table_present[1] THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.jlwm_config'::regclass
        AND c.contype IN ('u','p')
        AND pg_get_constraintdef(c.oid) ~* '\(office_id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = 'public.jlwm_config'::regclass
        AND x.indisunique AND x.indisvalid AND x.indisready
        AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indnkeyatts = 1
        AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
            AND NOT a.attisdropped AND a.attname = 'office_id'
        )
    ) INTO has_unique;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.jlwm_config'::regclass
        AND c.contype = 'u'
        AND c.conname = 'jlwm_config_office_id_key'
        AND (
          pg_get_constraintdef(c.oid) !~* '\(office_id\)'
          OR pg_get_constraintdef(c.oid) ~* ','
        )
    ) INTO wrong_unique;

    IF wrong_unique THEN
      incompatible_unique := array_append(incompatible_unique, 'jlwm_config_office_id_key');
    ELSIF NOT has_unique THEN
      missing_unique := array_append(missing_unique, 'jlwm_config(office_id)');
    END IF;
  END IF;

  /* twin UNIQUEs */
  FOR unique_spec IN
    SELECT * FROM (VALUES
      ('jlwm_case_twins', 'jlwm_case_twins_office_id_case_id_key',
       ARRAY['office_id','case_id']::TEXT[], '\(office_id,\s*case_id\)'),
      ('jlwm_client_twins', 'jlwm_client_twins_office_id_client_id_key',
       ARRAY['office_id','client_id']::TEXT[], '\(office_id,\s*client_id\)'),
      ('jlwm_firm_twin', 'jlwm_firm_twin_office_id_snapshot_date_key',
       ARRAY['office_id','snapshot_date']::TEXT[], '\(office_id,\s*snapshot_date\)')
    ) AS u(table_name, constraint_name, cols, def_re)
  LOOP
    IF to_regclass(format('public.%I', unique_spec.table_name)) IS NULL THEN
      CONTINUE;
    END IF;
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname = unique_spec.table_name;
    IF NOT FOUND OR actual_relkind NOT IN ('r','p') THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', unique_spec.table_name))
        AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) ~* unique_spec.def_re
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = to_regclass(format('public.%I', unique_spec.table_name))
        AND x.indisunique AND x.indisvalid AND x.indisready
        AND x.indpred IS NULL AND x.indexprs IS NULL
        AND (
          SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a
            ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
        ) = unique_spec.cols
    ) INTO has_unique;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', unique_spec.table_name))
        AND c.contype = 'u'
        AND c.conname = unique_spec.constraint_name
        AND pg_get_constraintdef(c.oid) !~* unique_spec.def_re
    ) INTO wrong_unique;

    IF wrong_unique THEN
      incompatible_unique := array_append(incompatible_unique, unique_spec.constraint_name);
    ELSIF NOT has_unique THEN
      missing_unique := array_append(
        missing_unique,
        format('%s(%s)', unique_spec.table_name, array_to_string(unique_spec.cols, ','))
      );
    END IF;
  END LOOP;

  /* ── 7) Indexes (non-unique + partial) + idx_jmn_uniq ─────────────────── */
  FOR index_spec IN
    SELECT * FROM (VALUES
      ('idx_jmn_office','jlwm_memory_nodes',ARRAY['office_id']::TEXT[],false,NULL),
      ('idx_jmn_type','jlwm_memory_nodes',ARRAY['office_id','node_type']::TEXT[],false,NULL),
      ('idx_jmn_ref','jlwm_memory_nodes',ARRAY['office_id','node_ref']::TEXT[],false,NULL),
      ('idx_jme_office','jlwm_memory_edges',ARRAY['office_id']::TEXT[],false,NULL),
      ('idx_jme_from','jlwm_memory_edges',ARRAY['from_node_id']::TEXT[],false,NULL),
      ('idx_jme_to','jlwm_memory_edges',ARRAY['to_node_id']::TEXT[],false,NULL),
      ('idx_jws_office_time','jlwm_world_states',ARRAY['office_id','computed_at']::TEXT[],false,NULL),
      ('idx_jlp_office','jlwm_legal_patterns',ARRAY['office_id']::TEXT[],false,NULL),
      ('idx_jcs_office_time','jlwm_command_sessions',ARRAY['office_id','created_at']::TEXT[],false,NULL),
      ('idx_jca_office_time','jlwm_command_actions',ARRAY['office_id','started_at']::TEXT[],false,NULL),
      ('idx_jct_office','jlwm_case_twins',ARRAY['office_id']::TEXT[],false,NULL),
      ('idx_jct_case','jlwm_case_twins',ARRAY['case_id']::TEXT[],false,NULL),
      ('idx_jct_risk','jlwm_case_twins',ARRAY['office_id','risk_level']::TEXT[],false,NULL),
      ('idx_jclt_office','jlwm_client_twins',ARRAY['office_id']::TEXT[],false,NULL),
      ('idx_jclt_client','jlwm_client_twins',ARRAY['client_id']::TEXT[],false,NULL),
      ('idx_jclt_churn','jlwm_client_twins',ARRAY['office_id','churn_risk']::TEXT[],false,NULL),
      ('idx_jft_office','jlwm_firm_twin',ARRAY['office_id']::TEXT[],false,NULL),
      ('idx_jpred_office','jlwm_predictions',ARRAY['office_id']::TEXT[],false,NULL),
      ('idx_jpred_type','jlwm_predictions',ARRAY['office_id','prediction_type']::TEXT[],false,NULL),
      ('idx_jpred_subject','jlwm_predictions',ARRAY['subject_type','subject_id']::TEXT[],false,NULL),
      ('idx_jrec_office_pri','jlwm_recommendations',ARRAY['office_id','priority']::TEXT[],false,NULL),
      ('idx_jra_office_sev','jlwm_radar_alerts',ARRAY['office_id','severity']::TEXT[],false,NULL),
      ('idx_jfb_office','jlwm_feedback',ARRAY['office_id']::TEXT[],false,NULL),
      ('idx_jfb_source','jlwm_feedback',ARRAY['source_type','source_id']::TEXT[],false,NULL),
      ('idx_jrec_unread','jlwm_recommendations',ARRAY['office_id','is_read']::TEXT[],true,'unread'),
      ('idx_jra_unack','jlwm_radar_alerts',ARRAY['office_id','is_acknowledged']::TEXT[],true,'unack')
    ) AS expected_index(index_name, table_name, expected_cols, is_partial, pred_kind)
  LOOP
    /* Missing target table → index gap is covered by TABLE_MISSING / skip */
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
    pred_sql := NULL;

    SELECT
      i.oid, i.relkind, t.relname, x.indisunique, x.indpred IS NOT NULL,
      x.indexprs IS NOT NULL, x.indisvalid, x.indisready,
      pg_get_expr(x.indpred, x.indrelid),
      (
        SELECT array_agg(a.attname::TEXT ORDER BY key_col.ordinality)
        FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS key_col(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid AND a.attnum = key_col.attnum AND NOT a.attisdropped
      )
    INTO
      index_oid, index_relkind, index_table, index_unique, index_partial,
      index_expression, index_valid, index_ready, pred_sql, index_cols
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    LEFT JOIN pg_class t ON t.oid = x.indrelid
    WHERE n.nspname = 'public' AND i.relname = index_spec.index_name;

    IF NOT FOUND THEN
      missing_indexes := array_append(missing_indexes, index_spec.index_name);
    ELSE
      pred_norm := lower(regexp_replace(COALESCE(pred_sql, ''), '\s+', '', 'g'));
      IF index_relkind NOT IN ('i', 'I')
         OR index_table IS DISTINCT FROM index_spec.table_name
         OR index_unique IS DISTINCT FROM FALSE
         OR index_expression IS DISTINCT FROM FALSE
         OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE
         OR index_cols IS DISTINCT FROM index_spec.expected_cols
         OR (
           CASE
             WHEN index_spec.is_partial THEN
               index_partial IS DISTINCT FROM TRUE
               OR (
                 CASE index_spec.pred_kind
                   WHEN 'unread' THEN pred_norm NOT IN ('(is_read=false)', '(notis_read)')
                   WHEN 'unack' THEN pred_norm NOT IN ('(is_acknowledged=false)', '(notis_acknowledged)')
                   ELSE true
                 END
               )
             ELSE
               index_partial IS DISTINCT FROM FALSE
           END
         ) THEN
        incompatible_indexes := array_append(
          incompatible_indexes,
          format('%s(table=%s,cols=%s,unique=%s,partial=%s,pred=%s)',
            index_spec.index_name, coalesce(index_table,'<none>'),
            coalesce(index_cols::TEXT,'<none>'), coalesce(index_unique::TEXT,'<null>'),
            coalesce(index_partial::TEXT,'<null>'), coalesce(pred_sql,'<none>'))
        );
      END IF;
    END IF;
  END LOOP;

  /* idx_jmn_uniq — UNIQUE partial (office_id,node_type,node_ref) WHERE node_ref IS NOT NULL */
  IF table_present[2] THEN
    SELECT
      x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready, pg_get_expr(x.indpred, x.indrelid),
      (
        SELECT array_agg(a.attname::TEXT ORDER BY key_col.ordinality)
        FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS key_col(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid AND a.attnum = key_col.attnum AND NOT a.attisdropped
      )
    INTO
      actual_table_oid, index_unique, index_partial, index_expression,
      index_valid, index_ready, pred_sql, index_cols
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    WHERE n.nspname = 'public' AND i.relname = 'idx_jmn_uniq';

    IF NOT FOUND THEN
      missing_unique := array_append(missing_unique, 'idx_jmn_uniq');
      missing_indexes := array_append(missing_indexes, 'idx_jmn_uniq');
    ELSE
      pred_norm := lower(regexp_replace(COALESCE(pred_sql, ''), '\s+', '', 'g'));
      expected_table_oid := 'public.jlwm_memory_nodes'::regclass;
      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS NOT TRUE
         OR index_partial IS NOT TRUE
         OR index_expression IS TRUE
         OR index_valid IS NOT TRUE
         OR index_ready IS NOT TRUE
         OR index_cols IS DISTINCT FROM ARRAY['office_id','node_type','node_ref']::TEXT[]
         OR pred_norm IS DISTINCT FROM '(node_refisnotnull)' THEN
        incompatible_unique := array_append(
          incompatible_unique,
          format('idx_jmn_uniq(unique=%s,partial=%s,cols=%s,pred=%s)',
            coalesce(index_unique::TEXT,'<null>'),
            coalesce(index_partial::TEXT,'<null>'),
            coalesce(index_cols::TEXT,'<none>'),
            coalesce(pred_sql,'<none>'))
        );
      END IF;
    END IF;
  ELSE
    missing_indexes := array_append(missing_indexes, 'idx_jmn_uniq');
  END IF;

  /* ── 8) Memory edges FK + orphan diagnostics ──────────────────────────── */
  IF table_present[2] AND table_present[3] THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.jlwm_memory_edges'::regclass
        AND c.contype = 'f'
        AND c.conname = 'jlwm_memory_edges_from_node_id_fkey'
    ) INTO fk_from;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.jlwm_memory_edges'::regclass
        AND c.contype = 'f'
        AND c.conname = 'jlwm_memory_edges_to_node_id_fkey'
    ) INTO fk_to;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='jlwm_memory_edges' AND column_name='from_node_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='jlwm_memory_edges' AND column_name='to_node_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='jlwm_memory_nodes' AND column_name='id'
    ) THEN
      SELECT count(*) INTO orphan_from
      FROM public.jlwm_memory_edges e
      WHERE e.from_node_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.jlwm_memory_nodes n WHERE n.id = e.from_node_id);
      SELECT count(*) INTO orphan_to
      FROM public.jlwm_memory_edges e
      WHERE e.to_node_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.jlwm_memory_nodes n WHERE n.id = e.to_node_id);
    END IF;

    IF fk_from AND fk_to THEN
      fk_status := 'INSTALLED';
    ELSIF orphan_from > 0 OR orphan_to > 0 THEN
      fk_status := format('DEFERRED orphan_from=%s orphan_to=%s', orphan_from, orphan_to);
    ELSE
      fk_status := 'PENDING';
      missing_fk := true;
    END IF;
  ELSIF cardinality(missing_tables) = cardinality(owned_tables) THEN
    fk_status := 'N/A';
  ELSE
    fk_status := 'PENDING';
    IF table_present[3] THEN
      missing_fk := true;
    END IF;
  END IF;

  /* ── 9) Decision ladder (blockers win over every safe repair) ─────────── */
  IF cardinality(incompatible_objects) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
    lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_types) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
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
  ELSIF dup_config > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_CONFIG_OFFICE_ID';
    lock_risk := 'HIGH';
  ELSIF dup_case > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_CASE_TWIN';
    lock_risk := 'HIGH';
  ELSIF dup_client > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_CLIENT_TWIN';
    lock_risk := 'HIGH';
  ELSIF dup_firm > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_FIRM_TWIN';
    lock_risk := 'HIGH';
  ELSIF dup_memory > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_MEMORY_NODE';
    lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_PK';
    lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_unique) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_UNIQUE';
    lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_INDEX';
    lock_risk := 'HIGH';

  /* Safe repairs — only after all blockers are absent */
  ELSIF cardinality(missing_tables) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'TABLE_MISSING';
    lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns) > 0
     OR cardinality(missing_pks) > 0
     OR cardinality(missing_unique) > 0
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
  ELSIF missing_fk
     OR fk_status = 'PENDING'
     OR fk_status LIKE 'DEFERRED%' THEN
    /* Schema otherwise usable, but memory-edge FK is not fully installed.
       Never claim ALREADY_CORRECT / JLWM_CORE_SCHEMA_READY here. */
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'READY_WITH_DEFERRED_FK';
    lock_risk := 'MEDIUM';
  ELSIF fk_status = 'INSTALLED' THEN
    /* FULL READY — only when FK is INSTALLED and every other contract check passed */
    action := 'ALREADY_CORRECT';
    reason_code := 'JLWM_CORE_SCHEMA_READY';
    lock_risk := 'LOW';
  ELSE
    /* Defensive: unknown/non-INSTALLED fk_status is never full-ready */
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'READY_WITH_DEFERRED_FK';
    lock_risk := 'MEDIUM';
  END IF;

  /* ── 10) Diagnostics notices ──────────────────────────────────────────── */
  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx > 1 THEN
      rows_notice := rows_notice || ' ';
    END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;

  RAISE NOTICE '034_preflight: estimated_rows %', rows_notice;
  RAISE NOTICE '034_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '034_preflight: orphan_edges from=% to=% fk_status=%',
    orphan_from, orphan_to, fk_status;
  RAISE NOTICE '034_preflight: non_uuid_office_id_count=% details=%',
    non_uuid_count,
    coalesce(nullif(array_to_string(non_uuid_details, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: null_office_id_count=% details=%',
    null_office_count,
    coalesce(nullif(array_to_string(null_office_details, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: null_required_count=% details=%',
    null_required_count,
    coalesce(nullif(array_to_string(null_required_details, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: duplicate_details=%',
    coalesce(nullif(array_to_string(duplicate_details, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects, ','), ''), empty_text),
    coalesce(nullif(array_to_string(incompatible_types, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: incompatible_pks=% incompatible_unique=% incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_pks, ','), ''), empty_text),
    coalesce(nullif(array_to_string(incompatible_unique, ','), ''), empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: missing_tables=%',
    coalesce(nullif(array_to_string(missing_tables, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: missing_columns=%',
    coalesce(nullif(array_to_string(missing_columns, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults, ','), ''), empty_text),
    coalesce(nullif(array_to_string(missing_not_null, ','), ''), empty_text);
  RAISE NOTICE '034_preflight: missing_pks=% missing_unique=% missing_indexes=% missing_fk=%',
    coalesce(nullif(array_to_string(missing_pks, ','), ''), empty_text),
    coalesce(nullif(array_to_string(missing_unique, ','), ''), empty_text),
    coalesce(nullif(array_to_string(missing_indexes, ','), ''), empty_text),
    missing_fk;

  IF orphan_from > 0 OR orphan_to > 0 THEN
    RAISE NOTICE '034_preflight: FK_DEFERRED_ORPHANS orphan_from=% orphan_to=% (informational; migration may defer FK)',
      orphan_from, orphan_to;
  END IF;

  RAISE NOTICE '034_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '034_preflight: BLOCK — do not apply Migration 034 until every reported blocker is resolved';
    RAISE EXCEPTION '034_preflight: chosen_action=% reason_code=%', action, reason_code;
  ELSIF action = 'SAFE_AUTO_REPAIR' THEN
    IF reason_code = 'READY_WITH_DEFERRED_FK' THEN
      RAISE NOTICE '034_preflight: SAFE_AUTO_REPAIR reason_code=READY_WITH_DEFERRED_FK — LEGACY SAFE BUT FK NOT FULLY READY (fk_status=%); not ALREADY_CORRECT / not JLWM_CORE_SCHEMA_READY',
        fk_status;
    ELSE
      RAISE NOTICE '034_preflight: SAFE_AUTO_REPAIR — Migration 034 may repair the reported non-blocking gaps';
    END IF;
  ELSE
    RAISE NOTICE '034_preflight: ALREADY_CORRECT — FULL READY (reason_code=JLWM_CORE_SCHEMA_READY; fk_status=INSTALLED)';
  END IF;
END
$preflight$;
