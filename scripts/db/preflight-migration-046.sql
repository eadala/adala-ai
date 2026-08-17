-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 046 — READ-ONLY checks for Support Enterprise schema
--
-- This script reads catalogs/data and emits notices only. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Owned objects:
--   support_tickets EXTENSIONS (office_id, case_id, invoice_id,
--     conversation_id, visitor_id, visitor_phone, department,
--     assigned_to_name, internal_notes, source, sla_response_deadline,
--     sla_resolution_deadline, first_response_at, closed_at, reopened_at,
--     waiting_since, tags, satisfaction_score, ai_score) — all nullable
--   support_ticket_attachments (+ FK CASCADE to support_tickets(id))
--   support_ticket_audit (no invented FK/UNIQUE)
--   support_visitor_profiles (+ UNIQUE(email), nullable — multiple NULLs OK)
--   Indexes (7): idx_st_user, idx_st_status, idx_st_office, idx_st_sla_res
--     (partial), idx_sta_ticket, idx_stau_ticket, idx_sm_ticket
--
-- support_tickets and support_messages are the 003-owned BASE tables that
-- this migration extends/indexes but never creates. On a database that has
-- not yet run Migration 003, support_tickets is absent and Migration 046
-- CANNOT safely repair that gap (SAFE_AUTO_REPAIR cannot invent a 003 base
-- table) — this is reported as a hard BLOCK (MISSING_BASE_TABLE), not
-- TABLE_MISSING/SAFE. The three satellites (support_ticket_attachments,
-- support_ticket_audit, support_visitor_profiles) ARE owned by 046 and CAN
-- be SAFE_AUTO_REPAIR TABLE_MISSING on their own.
--
-- ticket_id (TEXT) is never UUID-validated.
--
-- Blockers are collected before the decision ladder. Any blocker wins over
-- every safe repair, including missing tables. Decision ladder order
-- (highest priority first):
--   MISSING_BASE_TABLE > INCOMPATIBLE_TYPE (objects|types) > INCOMPATIBLE_PK
--   > INCOMPATIBLE_FK (wrong FK shape) > ORPHAN_FK > INCOMPATIBLE_UNIQUE
--   > DUPLICATE_UNIQUE_KEY > INCOMPATIBLE_INDEX > NULL_REQUIRED
--   > SAFE: TABLE_MISSING, PARTIAL_SCHEMA (cols/pks/uniques/fks/indexes),
--     MISSING_COLUMN_DEFAULTS, SET_NOT_NULL_PENDING
--   > ALREADY_CORRECT (reason_code=SUPPORT_ENTERPRISE_SCHEMA_READY)
--
-- Reason codes:
--   MISSING_BASE_TABLE, INCOMPATIBLE_TYPE, INCOMPATIBLE_PK, INCOMPATIBLE_FK,
--   ORPHAN_FK, INCOMPATIBLE_UNIQUE, DUPLICATE_UNIQUE_KEY, INCOMPATIBLE_INDEX,
--   NULL_REQUIRED, TABLE_MISSING, PARTIAL_SCHEMA, MISSING_COLUMN_DEFAULTS,
--   SET_NOT_NULL_PENDING. SUPPORT_ENTERPRISE_SCHEMA_READY means
--   ALREADY_CORRECT.
--
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 046 preflight: object presence'
SELECT
  to_regclass('public.support_tickets') IS NOT NULL AS support_tickets_base_present,
  to_regclass('public.support_messages') IS NOT NULL AS support_messages_base_present,
  to_regclass('public.support_ticket_attachments') IS NOT NULL AS support_ticket_attachments_present,
  to_regclass('public.support_ticket_audit') IS NOT NULL AS support_ticket_audit_present,
  to_regclass('public.support_visitor_profiles') IS NOT NULL AS support_visitor_profiles_present;

\echo '▶ 046 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_satellite_tables CONSTANT TEXT[] := ARRAY[
    'support_ticket_attachments','support_ticket_audit','support_visitor_profiles'
  ]::TEXT[];

  missing_base_table BOOLEAN := false;
  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_defaults TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_uniques TEXT[] := ARRAY[]::TEXT[];
  missing_fks TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  pending_fk_validation TEXT[] := ARRAY[]::TEXT[];
  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_uniques TEXT[] := ARRAY[]::TEXT[];
  incompatible_fks TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];
  orphan_fk_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0,0,0]::BIGINT[];
  null_required_count BIGINT := 0;
  duplicate_count BIGINT := 0;
  orphan_fk_count BIGINT := 0;
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

  has_uq BOOLEAN;
  wrong_uq BOOLEAN;
  bad_exact_uq BOOLEAN;
  near_miss_uq BOOLEAN;
  expression_uq BOOLEAN;

  fk_ok BOOLEAN;
  fk_present BOOLEAN;
  fk_shape_ok BOOLEAN;
  child_attnum INT2;
  ref_attnum INT2;
  orphan_cnt BIGINT;

  idx_relkind "char";
  idx_table TEXT;
  idx_unique BOOLEAN;
  idx_partial BOOLEAN;
  idx_expr BOOLEAN;
  idx_valid BOOLEAN;
  idx_ready BOOLEAN;
  idx_cols TEXT[];
  idx_opts INT[];
  idx_pred TEXT;
  desc_ok BOOLEAN;
  pred_ok BOOLEAN;
  opts_i INT;

  empty_text TEXT := '<none>';
  rows_notice TEXT := '';
BEGIN
  -- ── 0) Base table guard (support_tickets is 003-owned; 046 cannot repair) ─
  IF to_regclass('public.support_tickets') IS NULL THEN
    missing_base_table := true;
  END IF;

  -- ── 1) Satellite presence, relkind, and row counts ───────────────────────
  FOR tbl_idx IN 1..cardinality(owned_satellite_tables) LOOP
    tbl := owned_satellite_tables[tbl_idx];
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

  -- ── 2) Column type/default/not-null contract probe ───────────────────────
  -- support_tickets EXTENSIONS are all nullable (required_not_null=FALSE);
  -- satellite required columns are the only required_not_null=TRUE entries.
  -- ticket_id is intentionally excluded from any UUID-shape check.
  FOR column_spec IN
    SELECT * FROM (VALUES
      ('support_tickets','office_id','text',FALSE,NULL,NULL),
      ('support_tickets','case_id','text',FALSE,NULL,NULL),
      ('support_tickets','invoice_id','text',FALSE,NULL,NULL),
      ('support_tickets','conversation_id','text',FALSE,NULL,NULL),
      ('support_tickets','visitor_id','text',FALSE,NULL,NULL),
      ('support_tickets','visitor_phone','text',FALSE,NULL,NULL),
      ('support_tickets','department','text',FALSE,NULL,NULL),
      ('support_tickets','assigned_to_name','text',FALSE,NULL,NULL),
      ('support_tickets','internal_notes','text',FALSE,NULL,NULL),
      ('support_tickets','source','text',FALSE,'literal','user'),
      ('support_tickets','sla_response_deadline','timestamptz',FALSE,NULL,NULL),
      ('support_tickets','sla_resolution_deadline','timestamptz',FALSE,NULL,NULL),
      ('support_tickets','first_response_at','timestamptz',FALSE,NULL,NULL),
      ('support_tickets','closed_at','timestamptz',FALSE,NULL,NULL),
      ('support_tickets','reopened_at','timestamptz',FALSE,NULL,NULL),
      ('support_tickets','waiting_since','timestamptz',FALSE,NULL,NULL),
      ('support_tickets','tags','_text',FALSE,'empty_arr',NULL),
      ('support_tickets','satisfaction_score','int4',FALSE,NULL,NULL),
      ('support_tickets','ai_score','numeric',FALSE,NULL,NULL),
      ('support_ticket_attachments','id','uuid',TRUE,'gen_uuid',NULL),
      ('support_ticket_attachments','ticket_id','text',TRUE,NULL,NULL),
      ('support_ticket_attachments','file_name','text',TRUE,NULL,NULL),
      ('support_ticket_attachments','file_url','text',TRUE,NULL,NULL),
      ('support_ticket_attachments','file_size','int4',FALSE,'literal','0'),
      ('support_ticket_attachments','file_type','text',FALSE,NULL,NULL),
      ('support_ticket_attachments','uploaded_by','text',TRUE,NULL,NULL),
      ('support_ticket_attachments','created_at','timestamptz',FALSE,'now',NULL),
      ('support_ticket_audit','id','uuid',TRUE,'gen_uuid',NULL),
      ('support_ticket_audit','ticket_id','text',TRUE,NULL,NULL),
      ('support_ticket_audit','user_id','text',FALSE,NULL,NULL),
      ('support_ticket_audit','user_name','text',FALSE,NULL,NULL),
      ('support_ticket_audit','action','text',TRUE,NULL,NULL),
      ('support_ticket_audit','old_value','text',FALSE,NULL,NULL),
      ('support_ticket_audit','new_value','text',FALSE,NULL,NULL),
      ('support_ticket_audit','ip_address','text',FALSE,NULL,NULL),
      ('support_ticket_audit','created_at','timestamptz',FALSE,'now',NULL),
      ('support_visitor_profiles','id','uuid',TRUE,'gen_uuid',NULL),
      ('support_visitor_profiles','email','text',FALSE,NULL,NULL),
      ('support_visitor_profiles','phone','text',FALSE,NULL,NULL),
      ('support_visitor_profiles','name','text',TRUE,NULL,NULL),
      ('support_visitor_profiles','first_visit','timestamptz',FALSE,'now',NULL),
      ('support_visitor_profiles','last_visit','timestamptz',FALSE,'now',NULL),
      ('support_visitor_profiles','ticket_count','int4',FALSE,'literal','1')
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
    ELSIF column_spec.default_kind='gen_uuid' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%gen_random_uuid%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected=gen_random_uuid(),actual=%s)',column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    ELSIF column_spec.default_kind='empty_arr' THEN
      IF coalesce(actual_default,'') NOT ILIKE '%{}%' THEN
        missing_defaults := array_append(missing_defaults,
          format('%s.%s(expected={},actual=%s)',column_spec.table_name,column_spec.column_name,
            coalesce(actual_default,'<none>')));
      END IF;
    END IF;
  END LOOP;

  -- ── 3) Duplicate non-null email groups (would block UNIQUE(email)) ───────
  -- NULL emails are never counted (WHERE email IS NOT NULL).
  IF to_regclass('public.support_visitor_profiles') IS NOT NULL THEN
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='support_visitor_profiles';
    IF FOUND AND actual_relkind IN ('r','p') THEN
      BEGIN
        EXECUTE $q$SELECT count(*) FROM (
          SELECT email FROM public.support_visitor_profiles
          WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1
        ) d$q$ INTO row_count;
        IF row_count > 0 THEN
          duplicate_count := duplicate_count + row_count;
          duplicate_details := array_append(duplicate_details, format('support_visitor_profiles(email)=%s', row_count));
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
      END;
    END IF;
  END IF;

  -- ── 4) PK (id) probes for the 3 owned satellites ─────────────────────────
  FOREACH tbl IN ARRAY owned_satellite_tables LOOP
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
      missing_pks := array_append(missing_pks, format('%s(id)', tbl));
    END IF;
  END LOOP;

  -- ── 5) UNIQUE(email) probe — exact single-column only ────────────────────
  -- Wider/wrong-order/partial/expression/invalid/not-ready near-miss shapes
  -- → INCOMPATIBLE_UNIQUE (never false READY).
  IF to_regclass('public.support_visitor_profiles') IS NOT NULL THEN
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='support_visitor_profiles';
    IF FOUND AND actual_relkind IN ('r','p') THEN
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.support_visitor_profiles'::regclass AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*email\s*\)'
          AND pg_get_constraintdef(c.oid) !~* ','
      ) OR EXISTS (
        SELECT 1 FROM pg_index x
        WHERE x.indrelid = 'public.support_visitor_profiles'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
          AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
               FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
               JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
              = ARRAY['email']::text[]
      ) INTO has_uq;

      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.support_visitor_profiles'::regclass AND c.contype = 'u'
          AND c.conname = 'support_visitor_profiles_email_key'
          AND (
            pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\(\s*email\s*\)'
            OR pg_get_constraintdef(c.oid) ~* ','
          )
      ) INTO wrong_uq;

      SELECT EXISTS (
        SELECT 1 FROM pg_index x
        WHERE x.indrelid = 'public.support_visitor_profiles'::regclass
          AND x.indisunique AND NOT x.indisprimary
          AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
               FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
               JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
              = ARRAY['email']::text[]
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
          WHERE x.indrelid = 'public.support_visitor_profiles'::regclass
            AND x.indisunique AND NOT x.indisprimary
            AND cardinality(c.cols) > 1
            AND ARRAY['email']::text[] <@ c.cols
        ) INTO near_miss_uq;
      END IF;

      expression_uq := false;
      IF NOT has_uq THEN
        SELECT EXISTS (
          SELECT 1 FROM pg_index x
          WHERE x.indrelid = 'public.support_visitor_profiles'::regclass
            AND x.indisunique AND NOT x.indisprimary
            AND x.indexprs IS NOT NULL
            AND pg_get_indexdef(x.indexrelid) ~* 'email'
        ) INTO expression_uq;
      END IF;

      IF wrong_uq OR bad_exact_uq OR near_miss_uq OR expression_uq THEN
        incompatible_uniques := array_append(
          incompatible_uniques,
          format('support_visitor_profiles(expected=email,same_name_wrong=%s,bad_exact=%s,near_miss=%s,expression=%s)',
            coalesce(wrong_uq::TEXT,'f'), coalesce(bad_exact_uq::TEXT,'f'),
            coalesce(near_miss_uq::TEXT,'f'), coalesce(expression_uq::TEXT,'f'))
        );
      ELSIF NOT has_uq THEN
        missing_uniques := array_append(missing_uniques, 'support_visitor_profiles(email)');
      END IF;
    END IF;
  END IF;

  -- ── 6) FK probe (support_ticket_attachments.ticket_id → support_tickets.id)
  -- Orphans are probed only when the base table AND child table both exist
  -- and the FK is not already correctly validated.
  IF to_regclass('public.support_tickets') IS NULL
     OR to_regclass('public.support_ticket_attachments') IS NULL THEN
    missing_fks := array_append(missing_fks, 'support_ticket_attachments_ticket_id_fkey');
  ELSE
    child_attnum := NULL; ref_attnum := NULL;
    BEGIN
      SELECT a.attnum INTO child_attnum
      FROM pg_attribute a
      WHERE a.attrelid = 'public.support_ticket_attachments'::regclass
        AND a.attname = 'ticket_id' AND NOT a.attisdropped;
      SELECT a.attnum INTO ref_attnum
      FROM pg_attribute a
      WHERE a.attrelid = 'public.support_tickets'::regclass
        AND a.attname = 'id' AND NOT a.attisdropped;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      missing_fks := array_append(missing_fks, 'support_ticket_attachments_ticket_id_fkey');
      child_attnum := NULL;
    END;

    IF child_attnum IS NOT NULL AND ref_attnum IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class ref ON ref.oid = c.confrelid
        WHERE c.conrelid = 'public.support_ticket_attachments'::regclass
          AND c.contype = 'f'
          AND c.conname = 'support_ticket_attachments_ticket_id_fkey'
          AND ref.relname = 'support_tickets'
          AND c.confdeltype = 'c'
          AND c.convalidated
          AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
          AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
      ) INTO fk_ok;

      IF NOT fk_ok THEN
        SELECT EXISTS (
          SELECT 1 FROM pg_constraint c
          WHERE c.conrelid = 'public.support_ticket_attachments'::regclass
            AND c.contype = 'f'
            AND c.conname = 'support_ticket_attachments_ticket_id_fkey'
        ) INTO fk_present;

        IF fk_present THEN
          SELECT EXISTS (
            SELECT 1 FROM pg_constraint c
            WHERE c.conrelid = 'public.support_ticket_attachments'::regclass
              AND c.contype = 'f'
              AND c.conname = 'support_ticket_attachments_ticket_id_fkey'
              AND NOT (
                EXISTS (SELECT 1 FROM pg_class ref WHERE ref.oid = c.confrelid AND ref.relname = 'support_tickets')
                AND c.confdeltype = 'c'
                AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
                AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
              )
          ) INTO fk_shape_ok;

          IF fk_shape_ok THEN
            incompatible_fks := array_append(incompatible_fks, 'support_ticket_attachments_ticket_id_fkey(wrong_shape)');
          ELSE
            -- Correct shape but not yet validated → SAFE (never ALREADY_CORRECT).
            pending_fk_validation := array_append(pending_fk_validation, 'support_ticket_attachments_ticket_id_fkey');
          END IF;
        ELSE
          missing_fks := array_append(missing_fks, 'support_ticket_attachments_ticket_id_fkey');
        END IF;

        -- Orphan probe regardless of constraint presence (rows are read-only
        -- here; never deleted/backfilled).
        BEGIN
          EXECUTE $q$SELECT count(*) FROM public.support_ticket_attachments c
             WHERE c.ticket_id IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM public.support_tickets p WHERE p.id = c.ticket_id
               )$q$ INTO orphan_cnt;
          IF orphan_cnt > 0 THEN
            orphan_fk_count := orphan_fk_count + orphan_cnt;
            orphan_fk_details := array_append(
              orphan_fk_details,
              format('support_ticket_attachments.ticket_id=%s', orphan_cnt)
            );
          END IF;
        EXCEPTION WHEN undefined_table OR undefined_column THEN
          NULL;
        END;
      END IF;
    END IF;
  END IF;

  -- ── 7) Indexes (7) — ALWAYS probed by NAME globally, even when the base
  -- table is missing (stolen-name → INCOMPATIBLE_INDEX wins over TABLE_MISSING
  -- / MISSING_BASE_TABLE). desc_bits[i]=1 means DESC (indoption bit0=1).
  FOR index_spec IN
    SELECT * FROM (VALUES
      ('idx_st_user','support_tickets',ARRAY['user_id']::TEXT[],ARRAY[0]::INT[],FALSE,NULL::TEXT),
      ('idx_st_status','support_tickets',ARRAY['status','created_at']::TEXT[],ARRAY[0,1]::INT[],FALSE,NULL::TEXT),
      ('idx_st_office','support_tickets',ARRAY['office_id','status']::TEXT[],ARRAY[0,0]::INT[],FALSE,NULL::TEXT),
      ('idx_st_sla_res','support_tickets',ARRAY['sla_resolution_deadline']::TEXT[],ARRAY[0]::INT[],TRUE,'closed_resolved'),
      ('idx_sta_ticket','support_ticket_attachments',ARRAY['ticket_id']::TEXT[],ARRAY[0]::INT[],FALSE,NULL::TEXT),
      ('idx_stau_ticket','support_ticket_audit',ARRAY['ticket_id','created_at']::TEXT[],ARRAY[0,1]::INT[],FALSE,NULL::TEXT),
      ('idx_sm_ticket','support_messages',ARRAY['ticket_id','created_at']::TEXT[],ARRAY[0,0]::INT[],FALSE,NULL::TEXT)
    ) AS expected_index(index_name, table_name, expected_cols, desc_bits, expect_partial, partial_kind)
  LOOP
    idx_relkind := NULL; idx_table := NULL; idx_unique := NULL;
    idx_partial := NULL; idx_expr := NULL; idx_valid := NULL; idx_ready := NULL;
    idx_cols := NULL; idx_opts := NULL; idx_pred := NULL;
    SELECT i.relkind, t.relname, x.indisunique, x.indpred IS NOT NULL,
           x.indexprs IS NOT NULL, x.indisvalid, x.indisready,
           (SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality)
            FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum, ordinality)
            LEFT JOIN pg_attribute a
              ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
           (SELECT array_agg(o::INT ORDER BY k.ordinality)
            FROM unnest(x.indoption) WITH ORDINALITY AS k(o,ordinality)),
           pg_get_expr(x.indpred, x.indrelid)
    INTO idx_relkind, idx_table, idx_unique, idx_partial, idx_expr,
         idx_valid, idx_ready, idx_cols, idx_opts, idx_pred
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    LEFT JOIN pg_class t ON t.oid = x.indrelid
    WHERE n.nspname = 'public' AND i.relname = index_spec.index_name;

    IF NOT FOUND THEN
      missing_indexes := array_append(missing_indexes, index_spec.index_name);
    ELSE
      desc_ok := true;
      IF idx_opts IS NULL OR cardinality(idx_opts) IS DISTINCT FROM cardinality(index_spec.desc_bits) THEN
        desc_ok := false;
      ELSE
        FOR opts_i IN 1 .. cardinality(index_spec.desc_bits) LOOP
          IF (idx_opts[opts_i] & 1) IS DISTINCT FROM index_spec.desc_bits[opts_i] THEN
            desc_ok := false;
          END IF;
        END LOOP;
      END IF;

      pred_ok := true;
      IF index_spec.expect_partial AND index_spec.partial_kind = 'closed_resolved' THEN
        -- Postgres canonicalizes "status NOT IN ('closed','resolved')" to
        -- "status <> ALL (ARRAY['closed','resolved'])" internally — accept
        -- either surface form as long as both literals are negated on status.
        pred_ok := coalesce(idx_pred,'') ~* 'status'
          AND coalesce(idx_pred,'') ~* 'closed'
          AND coalesce(idx_pred,'') ~* 'resolved'
          AND (coalesce(idx_pred,'') ~* 'not\s+in' OR coalesce(idx_pred,'') ~* '<>\s*all');
      END IF;

      IF idx_relkind NOT IN ('i','I')
         OR idx_table IS DISTINCT FROM index_spec.table_name
         OR idx_unique IS DISTINCT FROM FALSE
         OR idx_partial IS DISTINCT FROM index_spec.expect_partial
         OR idx_expr IS DISTINCT FROM FALSE
         OR idx_valid IS DISTINCT FROM TRUE
         OR idx_ready IS DISTINCT FROM TRUE
         OR idx_cols IS DISTINCT FROM index_spec.expected_cols
         OR desc_ok IS NOT TRUE
         OR pred_ok IS NOT TRUE THEN
        incompatible_indexes := array_append(incompatible_indexes,
          format('%s(table=%s,cols=%s,unique=%s,partial=%s,pred=%s,desc_ok=%s,valid=%s,ready=%s)',
            index_spec.index_name,
            coalesce(idx_table,'<none>'),
            coalesce(idx_cols::TEXT,'<none>'),
            coalesce(idx_unique::TEXT,'<null>'),
            coalesce(idx_partial::TEXT,'<null>'),
            coalesce(idx_pred,'<none>'),
            coalesce(desc_ok::TEXT,'<null>'),
            coalesce(idx_valid::TEXT,'<null>'),
            coalesce(idx_ready::TEXT,'<null>')));
      END IF;
    END IF;
  END LOOP;

  -- ── 8) Decision ladder (blockers before SAFE; MISSING_BASE_TABLE first) ──
  IF missing_base_table THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'MISSING_BASE_TABLE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_fks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_FK'; lock_risk := 'HIGH';
  ELSIF orphan_fk_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'ORPHAN_FK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_uniques)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_UNIQUE'; lock_risk := 'HIGH';
  ELSIF duplicate_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'DUPLICATE_UNIQUE_KEY'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_INDEX'; lock_risk := 'HIGH';
  ELSIF null_required_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0
     OR cardinality(missing_uniques)>0 OR cardinality(missing_fks)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_indexes)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(pending_fk_validation)>0 THEN
    -- Orphan-free correct-shape NOT VALID FK → migration may VALIDATE CONSTRAINT.
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_COLUMN_DEFAULTS'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'SUPPORT_ENTERPRISE_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_satellite_tables) LOOP
    IF tbl_idx>1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_satellite_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '046_preflight: support_tickets_base_missing=%',missing_base_table;
  RAISE NOTICE '046_preflight: estimated_rows %',rows_notice;
  RAISE NOTICE '046_preflight: lock_risk=%',lock_risk;
  RAISE NOTICE '046_preflight: null_required_count=% details=%',null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''),empty_text);
  RAISE NOTICE '046_preflight: duplicate_unique_keys=%',
    coalesce(nullif(array_to_string(duplicate_details,','),''),empty_text);
  RAISE NOTICE '046_preflight: orphan_fk_count=% details=%',orphan_fk_count,
    coalesce(nullif(array_to_string(orphan_fk_details,','),''),empty_text);
  RAISE NOTICE '046_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''),empty_text);
  RAISE NOTICE '046_preflight: incompatible_pks=% incompatible_uniques=% incompatible_fks=%',
    coalesce(nullif(array_to_string(incompatible_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_fks,','),''),empty_text);
  RAISE NOTICE '046_preflight: incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_indexes,','),''),empty_text);
  RAISE NOTICE '046_preflight: missing_tables=%',
    coalesce(nullif(array_to_string(missing_tables,','),''),empty_text);
  RAISE NOTICE '046_preflight: missing_columns=%',coalesce(nullif(array_to_string(missing_columns,','),''),empty_text);
  RAISE NOTICE '046_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''),empty_text);
  RAISE NOTICE '046_preflight: missing_pks=% missing_uniques=% missing_fks=% missing_indexes=%',
    coalesce(nullif(array_to_string(missing_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_fks,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_indexes,','),''),empty_text);
  RAISE NOTICE '046_preflight: pending_fk_validation=% (convalidated=false; never ALREADY)',
    coalesce(nullif(array_to_string(pending_fk_validation,','),''),empty_text);
  RAISE NOTICE '046_preflight: chosen_action=% reason_code=%',action,reason_code;

  IF action='BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '046_preflight: BLOCK — do not apply Migration 046 until every blocker is resolved';
    RAISE EXCEPTION '046_preflight: chosen_action=% reason_code=%',action,reason_code;
  ELSIF action='SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '046_preflight: SAFE_AUTO_REPAIR — Migration 046 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '046_preflight: ALREADY_CORRECT — FULL READY (reason_code=SUPPORT_ENTERPRISE_SCHEMA_READY)';
  END IF;
END
$preflight$;
