-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 038 — READ-ONLY checks for Marketplace + Client Portal
--
-- This script reads catalogs/data and emits notices only. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Owned tables (11):
--   marketplace_services, marketplace_orders, marketplace_deals, marketplace_deal_offers,
--   client_portal_tokens, case_timeline, portal_uploads,
--   client_accounts, client_sessions, client_case_links, home_cms
-- Extension surface (003-owned base):
--   clients.client_account_id TEXT (nullable; no backfill required)
--
-- Blockers are collected before the decision ladder. Any blocker wins over
-- every safe repair, including missing tables.
--
-- Reason codes:
--   INCOMPATIBLE_TYPE, NULL_REQUIRED, INCOMPATIBLE_PK, INCOMPATIBLE_UNIQUE,
--   INCOMPATIBLE_FK, DUPLICATE_UNIQUE_KEY, ORPHAN_FK, MISSING_BASE_TABLE,
--   FK_VALIDATION_PENDING (correct-shape FK present but convalidated=false; SAFE repair)
--   MARKETPLACE_PORTAL_SCHEMA_READY means ALREADY_CORRECT (validated FKs required).
--
-- Indexes: none required for 038 (no named Runtime indexes).
--
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 038 preflight: object presence'
SELECT
  to_regclass('public.marketplace_services') IS NOT NULL AS marketplace_services_present,
  to_regclass('public.marketplace_orders') IS NOT NULL AS marketplace_orders_present,
  to_regclass('public.marketplace_deals') IS NOT NULL AS marketplace_deals_present,
  to_regclass('public.marketplace_deal_offers') IS NOT NULL AS marketplace_deal_offers_present,
  to_regclass('public.client_portal_tokens') IS NOT NULL AS client_portal_tokens_present,
  to_regclass('public.case_timeline') IS NOT NULL AS case_timeline_present,
  to_regclass('public.portal_uploads') IS NOT NULL AS portal_uploads_present,
  to_regclass('public.client_accounts') IS NOT NULL AS client_accounts_present,
  to_regclass('public.client_sessions') IS NOT NULL AS client_sessions_present,
  to_regclass('public.client_case_links') IS NOT NULL AS client_case_links_present,
  to_regclass('public.home_cms') IS NOT NULL AS home_cms_present,
  to_regclass('public.clients') IS NOT NULL AS clients_present;

\echo '▶ 038 preflight: full contract and decision'
DO $preflight$
DECLARE
  owned_tables CONSTANT TEXT[] := ARRAY[
    'marketplace_services','marketplace_orders','marketplace_deals','marketplace_deal_offers',
    'client_portal_tokens','case_timeline','portal_uploads',
    'client_accounts','client_sessions','client_case_links','home_cms'
  ]::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_defaults TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_uniques TEXT[] := ARRAY[]::TEXT[];
  missing_fks TEXT[] := ARRAY[]::TEXT[];
  pending_fk_validation TEXT[] := ARRAY[]::TEXT[];
  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_uniques TEXT[] := ARRAY[]::TEXT[];
  incompatible_fks TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];
  orphan_fk_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0,0,0,0,0,0,0,0,0,0,0]::BIGINT[];
  null_required_count BIGINT := 0;
  duplicate_count BIGINT := 0;
  orphan_fk_count BIGINT := 0;
  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'LOW';

  column_spec RECORD;
  unique_spec RECORD;
  fk_spec RECORD;
  uq_idx_rec RECORD;
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
  near_miss_uq BOOLEAN;
  bad_exact_uq BOOLEAN;
  uq_cols TEXT[];
  uq_sorted TEXT[];
  expected_sorted TEXT[];
  fk_ok BOOLEAN;
  child_attnum INT2;
  ref_attnum INT2;
  orphan_cnt BIGINT;
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
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO row_count;
        estimated_rows[tbl_idx] := row_count;
      EXCEPTION WHEN undefined_table THEN
        missing_tables := array_append(missing_tables, tbl);
      END;
    END IF;
  END LOOP;

  IF to_regclass('public.clients') IS NULL THEN
    incompatible_objects := array_append(incompatible_objects, 'clients(MISSING_BASE_TABLE)');
  END IF;

  -- ── 2) All Runtime columns: type, required NULLs, and defaults ───────────
  FOR column_spec IN
    SELECT * FROM (VALUES
      ('marketplace_services','id','uuid',TRUE,'uuid',NULL),
      ('marketplace_services','user_id','text',TRUE,NULL,NULL),
      ('marketplace_services','office_name','text',FALSE,NULL,NULL),
      ('marketplace_services','title','text',TRUE,NULL,NULL),
      ('marketplace_services','description','text',FALSE,NULL,NULL),
      ('marketplace_services','category','text',TRUE,NULL,NULL),
      ('marketplace_services','price','numeric',FALSE,'literal','0'),
      ('marketplace_services','currency','text',FALSE,'literal','SAR'),
      ('marketplace_services','duration_minutes','int4',FALSE,NULL,NULL),
      ('marketplace_services','tags','text',FALSE,NULL,NULL),
      ('marketplace_services','is_active','bool',FALSE,'literal','true'),
      ('marketplace_services','rating','numeric',FALSE,'literal','0'),
      ('marketplace_services','total_reviews','int4',FALSE,'literal','0'),
      ('marketplace_services','total_orders','int4',FALSE,'literal','0'),
      ('marketplace_services','created_at','timestamptz',FALSE,'now',NULL),
      ('marketplace_services','updated_at','timestamptz',FALSE,'now',NULL),
      ('marketplace_orders','id','uuid',TRUE,'uuid',NULL),
      ('marketplace_orders','service_id','text',TRUE,NULL,NULL),
      ('marketplace_orders','service_title','text',FALSE,NULL,NULL),
      ('marketplace_orders','seller_id','text',TRUE,NULL,NULL),
      ('marketplace_orders','buyer_name','text',TRUE,NULL,NULL),
      ('marketplace_orders','buyer_email','text',FALSE,NULL,NULL),
      ('marketplace_orders','buyer_phone','text',FALSE,NULL,NULL),
      ('marketplace_orders','amount','numeric',FALSE,'literal','0'),
      ('marketplace_orders','notes','text',FALSE,NULL,NULL),
      ('marketplace_orders','status','text',FALSE,'literal','pending'),
      ('marketplace_orders','case_id','text',FALSE,NULL,NULL),
      ('marketplace_orders','created_at','timestamptz',FALSE,'now',NULL),
      ('marketplace_deals','id','uuid',TRUE,'uuid',NULL),
      ('marketplace_deals','service_id','text',TRUE,NULL,NULL),
      ('marketplace_deals','service_title','text',FALSE,NULL,NULL),
      ('marketplace_deals','seller_id','text',TRUE,NULL,NULL),
      ('marketplace_deals','buyer_name','text',TRUE,NULL,NULL),
      ('marketplace_deals','buyer_email','text',FALSE,NULL,NULL),
      ('marketplace_deals','buyer_phone','text',FALSE,NULL,NULL),
      ('marketplace_deals','initial_price','numeric',FALSE,NULL,NULL),
      ('marketplace_deals','final_price','numeric',FALSE,NULL,NULL),
      ('marketplace_deals','status','text',FALSE,'literal','open'),
      ('marketplace_deals','notes','text',FALSE,NULL,NULL),
      ('marketplace_deals','case_id','text',FALSE,NULL,NULL),
      ('marketplace_deals','created_at','timestamptz',FALSE,'now',NULL),
      ('marketplace_deal_offers','id','uuid',TRUE,'uuid',NULL),
      ('marketplace_deal_offers','deal_id','text',TRUE,NULL,NULL),
      ('marketplace_deal_offers','from_role','text',TRUE,NULL,NULL),
      ('marketplace_deal_offers','price','numeric',TRUE,NULL,NULL),
      ('marketplace_deal_offers','message','text',FALSE,NULL,NULL),
      ('marketplace_deal_offers','created_at','timestamptz',FALSE,'now',NULL),
      ('client_portal_tokens','id','text',TRUE,NULL,NULL),
      ('client_portal_tokens','case_id','text',TRUE,NULL,NULL),
      ('client_portal_tokens','token','text',TRUE,NULL,NULL),
      ('client_portal_tokens','client_email','text',FALSE,NULL,NULL),
      ('client_portal_tokens','client_name','text',FALSE,NULL,NULL),
      ('client_portal_tokens','expires_at','timestamptz',FALSE,NULL,NULL),
      ('client_portal_tokens','last_accessed','timestamptz',FALSE,NULL,NULL),
      ('client_portal_tokens','access_count','int4',FALSE,'literal','0'),
      ('client_portal_tokens','show_invoices','bool',FALSE,'literal','true'),
      ('client_portal_tokens','show_timeline','bool',FALSE,'literal','true'),
      ('client_portal_tokens','allowed_to_upload','bool',FALSE,'literal','false'),
      ('client_portal_tokens','shared_documents','jsonb',FALSE,'jsonb_arr',NULL),
      ('client_portal_tokens','created_at','timestamptz',FALSE,'now',NULL),
      ('case_timeline','id','text',TRUE,NULL,NULL),
      ('case_timeline','case_id','text',TRUE,NULL,NULL),
      ('case_timeline','entry_type','text',TRUE,'literal','note'),
      ('case_timeline','title','text',TRUE,NULL,NULL),
      ('case_timeline','description','text',FALSE,NULL,NULL),
      ('case_timeline','happened_at','timestamptz',FALSE,'now',NULL),
      ('case_timeline','is_shared','bool',FALSE,'literal','true'),
      ('case_timeline','created_by','text',FALSE,NULL,NULL),
      ('case_timeline','created_at','timestamptz',FALSE,'now',NULL),
      ('portal_uploads','id','text',TRUE,NULL,NULL),
      ('portal_uploads','portal_token','text',TRUE,NULL,NULL),
      ('portal_uploads','case_id','text',FALSE,NULL,NULL),
      ('portal_uploads','file_name','text',TRUE,NULL,NULL),
      ('portal_uploads','file_size','int4',FALSE,NULL,NULL),
      ('portal_uploads','file_type','text',FALSE,NULL,NULL),
      ('portal_uploads','file_path','text',FALSE,NULL,NULL),
      ('portal_uploads','uploaded_at','timestamptz',FALSE,'now',NULL),
      ('portal_uploads','is_read','bool',FALSE,'literal','false'),
      ('client_accounts','id','text',TRUE,'uuid_text',NULL),
      ('client_accounts','email','text',TRUE,NULL,NULL),
      ('client_accounts','password_hash','text',FALSE,NULL,NULL),
      ('client_accounts','name','text',FALSE,NULL,NULL),
      ('client_accounts','phone','text',FALSE,NULL,NULL),
      ('client_accounts','email_verified','bool',FALSE,'literal','false'),
      ('client_accounts','otp','text',FALSE,NULL,NULL),
      ('client_accounts','otp_expires','timestamptz',FALSE,NULL,NULL),
      ('client_accounts','created_at','timestamptz',FALSE,'now',NULL),
      ('client_accounts','updated_at','timestamptz',FALSE,'now',NULL),
      ('client_sessions','id','text',TRUE,'uuid_text',NULL),
      ('client_sessions','client_id','text',TRUE,NULL,NULL),
      ('client_sessions','token','text',TRUE,NULL,NULL),
      ('client_sessions','expires_at','timestamptz',TRUE,NULL,NULL),
      ('client_sessions','created_at','timestamptz',FALSE,'now',NULL),
      ('client_case_links','id','text',TRUE,'uuid_text',NULL),
      ('client_case_links','client_id','text',TRUE,NULL,NULL),
      ('client_case_links','case_id','text',TRUE,NULL,NULL),
      ('client_case_links','portal_token_id','text',FALSE,NULL,NULL),
      ('client_case_links','portal_token','text',FALSE,NULL,NULL),
      ('client_case_links','office_id','text',FALSE,NULL,NULL),
      ('client_case_links','linked_at','timestamptz',FALSE,'now',NULL),
      ('home_cms','id','int4',TRUE,'literal','1'),
      ('home_cms','hero','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','trust','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','features','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','cta_section','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','announcement','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','stats','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','seo','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','contact','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','footer','jsonb',TRUE,'jsonb_obj',NULL),
      ('home_cms','updated_at','timestamptz',FALSE,'now',NULL),
      ('home_cms','updated_by','text',FALSE,NULL,NULL)
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
    ELSIF column_spec.default_kind IN ('uuid','uuid_text') THEN
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

  -- clients.client_account_id extension (nullable TEXT)
  IF to_regclass('public.clients') IS NOT NULL THEN
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='clients' AND c.column_name='client_account_id';
    IF NOT FOUND THEN
      missing_columns := array_append(missing_columns, 'clients.client_account_id');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_types := array_append(
        incompatible_types,
        format('clients.client_account_id(expected=text,actual=%s)', coalesce(actual_udt,'<null>'))
      );
    END IF;
  END IF;

  -- ── 3) Duplicate UNIQUE data probes ──────────────────────────────────────
  IF to_regclass('public.client_portal_tokens') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT token FROM public.client_portal_tokens GROUP BY token HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('client_portal_tokens(token)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;
  IF to_regclass('public.client_accounts') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT email FROM public.client_accounts GROUP BY email HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('client_accounts(email)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;
  IF to_regclass('public.client_sessions') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT token FROM public.client_sessions GROUP BY token HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('client_sessions(token)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;
  IF to_regclass('public.client_case_links') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT client_id, case_id FROM public.client_case_links
        GROUP BY client_id, case_id HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('client_case_links(client_id,case_id)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;

  -- ── 4) PK probes (id only) ───────────────────────────────────────────────
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
      missing_pks := array_append(missing_pks, tbl);
    END IF;
  END LOOP;

  -- ── 5) UNIQUE probes (exact columns) ─────────────────────────────────────
  FOR unique_spec IN
    SELECT * FROM (VALUES
      ('client_portal_tokens','client_portal_tokens_token_key',ARRAY['token']::TEXT[],'UNIQUE\s*\(\s*token\s*\)'),
      ('client_accounts','client_accounts_email_key',ARRAY['email']::TEXT[],'UNIQUE\s*\(\s*email\s*\)'),
      ('client_sessions','client_sessions_token_key',ARRAY['token']::TEXT[],'UNIQUE\s*\(\s*token\s*\)'),
      ('client_case_links','client_case_links_client_id_case_id_key',ARRAY['client_id','case_id']::TEXT[],
       'UNIQUE\s*\(\s*client_id\s*,\s*case_id\s*\)')
    ) AS expected_unique(table_name,constraint_name,cols,def_re)
  LOOP
    IF to_regclass(format('public.%I', unique_spec.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', unique_spec.table_name))
        AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) ~* unique_spec.def_re
        AND c.convalidated
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = to_regclass(format('public.%I', unique_spec.table_name))
        AND x.indisunique AND NOT x.indisprimary
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND (
          SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality)
          FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum,ordinality)
          JOIN pg_attribute a
            ON a.attrelid = x.indrelid AND a.attnum = k.attnum AND NOT a.attisdropped
        ) = unique_spec.cols
    ) INTO has_uq;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', unique_spec.table_name))
        AND c.contype = 'u'
        AND c.conname = unique_spec.constraint_name
        AND (
          pg_get_constraintdef(c.oid) !~* unique_spec.def_re
          OR (
            cardinality(unique_spec.cols) = 1
            AND pg_get_constraintdef(c.oid) ~* ','
          )
        )
    ) INTO wrong_uq;

    SELECT EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = to_regclass(format('public.%I', unique_spec.table_name))
        AND x.indisunique AND NOT x.indisprimary
        AND (
          SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality)
          FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum,ordinality)
          JOIN pg_attribute a
            ON a.attrelid = x.indrelid AND a.attnum = k.attnum AND NOT a.attisdropped
        ) = unique_spec.cols
        AND (
          x.indisvalid IS DISTINCT FROM TRUE
          OR x.indisready IS DISTINCT FROM TRUE
          OR x.indpred IS NOT NULL
          OR x.indexprs IS NOT NULL
        )
    ) INTO bad_exact_uq;

    near_miss_uq := false;
    IF NOT has_uq THEN
      SELECT array_agg(x ORDER BY x) INTO expected_sorted FROM unnest(unique_spec.cols) AS x;
      FOR uq_idx_rec IN
        SELECT (
          SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality)
          FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS k(attnum,ordinality)
          JOIN pg_attribute a
            ON a.attrelid = x.indrelid AND a.attnum = k.attnum AND NOT a.attisdropped
        ) AS cols
        FROM pg_index x
        WHERE x.indrelid = to_regclass(format('public.%I', unique_spec.table_name))
          AND x.indisunique AND NOT x.indisprimary
      LOOP
        uq_cols := uq_idx_rec.cols;
        IF uq_cols IS NULL THEN CONTINUE; END IF;
        SELECT array_agg(x ORDER BY x) INTO uq_sorted FROM unnest(uq_cols) AS x;
        IF uq_cols IS DISTINCT FROM unique_spec.cols
           AND (
             (cardinality(uq_cols) > cardinality(unique_spec.cols)
              AND uq_cols[1:cardinality(unique_spec.cols)] = unique_spec.cols)
             OR (cardinality(uq_cols) = cardinality(unique_spec.cols)
                 AND uq_sorted IS NOT DISTINCT FROM expected_sorted)
             OR (cardinality(uq_cols) > cardinality(unique_spec.cols)
                 AND unique_spec.cols <@ uq_cols)
           ) THEN
          near_miss_uq := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF wrong_uq OR bad_exact_uq OR near_miss_uq THEN
      incompatible_uniques := array_append(
        incompatible_uniques,
        format(
          '%s(expected=%s,same_name_wrong=%s,bad_exact=%s,near_miss=%s)',
          unique_spec.table_name,
          array_to_string(unique_spec.cols, ','),
          coalesce(wrong_uq::TEXT, 'f'),
          coalesce(bad_exact_uq::TEXT, 'f'),
          coalesce(near_miss_uq::TEXT, 'f')
        )
      );
    ELSIF NOT has_uq THEN
      missing_uniques := array_append(
        missing_uniques,
        format('%s(%s)', unique_spec.table_name, array_to_string(unique_spec.cols, ','))
      );
    END IF;
  END LOOP;

  -- ── 6) FK probes (CASCADE to client_accounts) ────────────────────────────
  FOR fk_spec IN
    SELECT * FROM (VALUES
      ('client_sessions', 'client_sessions_client_id_fkey', 'client_id', 'client_accounts', 'id'),
      ('client_case_links', 'client_case_links_client_id_fkey', 'client_id', 'client_accounts', 'id')
    ) AS expected_fk(child_table, constraint_name, child_column, ref_table, ref_column)
  LOOP
    IF to_regclass(format('public.%I', fk_spec.child_table)) IS NULL
       OR to_regclass(format('public.%I', fk_spec.ref_table)) IS NULL THEN
      missing_fks := array_append(missing_fks, fk_spec.constraint_name);
      CONTINUE;
    END IF;

    child_attnum := NULL;
    ref_attnum := NULL;
    BEGIN
      SELECT a.attnum INTO child_attnum
      FROM pg_attribute a
      WHERE a.attrelid = to_regclass(format('public.%I', fk_spec.child_table))
        AND a.attname = fk_spec.child_column AND NOT a.attisdropped;
      SELECT a.attnum INTO ref_attnum
      FROM pg_attribute a
      WHERE a.attrelid = to_regclass(format('public.%I', fk_spec.ref_table))
        AND a.attname = fk_spec.ref_column AND NOT a.attisdropped;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      missing_fks := array_append(missing_fks, fk_spec.constraint_name);
      CONTINUE;
    END;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class ref ON ref.oid = c.confrelid
      WHERE c.conrelid = to_regclass(format('public.%I', fk_spec.child_table))
        AND c.contype = 'f'
        AND c.conname = fk_spec.constraint_name
        AND ref.relname = fk_spec.ref_table
        AND c.confdeltype = 'c'
        AND c.convalidated
        AND child_attnum IS NOT NULL
        AND ref_attnum IS NOT NULL
        AND array_length(c.conkey, 1) = 1
        AND c.conkey[1] = child_attnum
        AND array_length(c.confkey, 1) = 1
        AND c.confkey[1] = ref_attnum
    ) INTO fk_ok;

    IF fk_ok THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', fk_spec.child_table))
        AND c.contype = 'f'
        AND c.conname = fk_spec.constraint_name
        AND NOT (
          EXISTS (SELECT 1 FROM pg_class ref WHERE ref.oid = c.confrelid AND ref.relname = fk_spec.ref_table)
          AND c.confdeltype = 'c'
          AND child_attnum IS NOT NULL
          AND ref_attnum IS NOT NULL
          AND array_length(c.conkey, 1) = 1
          AND c.conkey[1] = child_attnum
          AND array_length(c.confkey, 1) = 1
          AND c.confkey[1] = ref_attnum
        )
    ) THEN
      incompatible_fks := array_append(
        incompatible_fks,
        format('%s(wrong_shape)', fk_spec.constraint_name)
      );
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format(
        $q$SELECT count(*) FROM public.%I c
           WHERE c.%I IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM public.%I p WHERE p.%I = c.%I
             )$q$,
        fk_spec.child_table, fk_spec.child_column,
        fk_spec.ref_table, fk_spec.ref_column, fk_spec.child_column
      ) INTO orphan_cnt;
      IF orphan_cnt > 0 THEN
        orphan_fk_count := orphan_fk_count + orphan_cnt;
        orphan_fk_details := array_append(
          orphan_fk_details,
          format('%s.%s=%s', fk_spec.child_table, fk_spec.child_column, orphan_cnt)
        );
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      NULL;
    END;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', fk_spec.child_table))
        AND c.contype = 'f'
        AND c.conname = fk_spec.constraint_name
    ) THEN
      missing_fks := array_append(missing_fks, fk_spec.constraint_name);
    ELSIF EXISTS (
      -- Correct shape / CASCADE / columns but NOT yet validated — never ALREADY_CORRECT.
      SELECT 1 FROM pg_constraint c
      JOIN pg_class ref ON ref.oid = c.confrelid
      WHERE c.conrelid = to_regclass(format('public.%I', fk_spec.child_table))
        AND c.contype = 'f'
        AND c.conname = fk_spec.constraint_name
        AND ref.relname = fk_spec.ref_table
        AND c.confdeltype = 'c'
        AND NOT c.convalidated
        AND child_attnum IS NOT NULL
        AND ref_attnum IS NOT NULL
        AND array_length(c.conkey, 1) = 1
        AND c.conkey[1] = child_attnum
        AND array_length(c.confkey, 1) = 1
        AND c.confkey[1] = ref_attnum
    ) THEN
      pending_fk_validation := array_append(pending_fk_validation, fk_spec.constraint_name);
    END IF;
  END LOOP;

  -- ── 7) Decision ladder (blockers before SAFE) ────────────────────────────
  IF to_regclass('public.clients') IS NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'MISSING_BASE_TABLE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_uniques)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_UNIQUE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_fks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_FK'; lock_risk := 'HIGH';
  ELSIF duplicate_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'DUPLICATE_UNIQUE_KEY'; lock_risk := 'HIGH';
  ELSIF orphan_fk_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'ORPHAN_FK'; lock_risk := 'HIGH';
  ELSIF null_required_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0
     OR cardinality(missing_uniques)>0 OR cardinality(missing_fks)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(pending_fk_validation)>0 THEN
    -- Orphan-free correct-shape NOT VALID FK → migration may VALIDATE CONSTRAINT.
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'FK_VALIDATION_PENDING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_COLUMN_DEFAULTS'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'MARKETPLACE_PORTAL_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx>1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '038_preflight: estimated_rows %',rows_notice;
  RAISE NOTICE '038_preflight: lock_risk=%',lock_risk;
  RAISE NOTICE '038_preflight: null_required_count=% details=%',null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''),empty_text);
  RAISE NOTICE '038_preflight: duplicate_unique_keys=%',
    coalesce(nullif(array_to_string(duplicate_details,','),''),empty_text);
  RAISE NOTICE '038_preflight: orphan_fk_count=% details=%',orphan_fk_count,
    coalesce(nullif(array_to_string(orphan_fk_details,','),''),empty_text);
  RAISE NOTICE '038_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''),empty_text);
  RAISE NOTICE '038_preflight: incompatible_pks=% incompatible_uniques=% incompatible_fks=%',
    coalesce(nullif(array_to_string(incompatible_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_uniques,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_fks,','),''),empty_text);
  RAISE NOTICE '038_preflight: missing_tables=%',
    coalesce(nullif(array_to_string(missing_tables,','),''),empty_text);
  RAISE NOTICE '038_preflight: missing_columns=%',coalesce(nullif(array_to_string(missing_columns,','),''),empty_text);
  RAISE NOTICE '038_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''),empty_text);
  RAISE NOTICE '038_preflight: missing_pks=% missing_uniques=% missing_fks=%',
    coalesce(nullif(array_to_string(missing_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_fks,','),''),empty_text);
  RAISE NOTICE '038_preflight: pending_fk_validation=% (convalidated=false; never ALREADY)',
    coalesce(nullif(array_to_string(pending_fk_validation,','),''),empty_text);
  RAISE NOTICE '038_preflight: chosen_action=% reason_code=%',action,reason_code;

  IF action='BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '038_preflight: BLOCK — do not apply Migration 038 until every blocker is resolved';
    RAISE EXCEPTION '038_preflight: chosen_action=% reason_code=%',action,reason_code;
  ELSIF action='SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '038_preflight: SAFE_AUTO_REPAIR — Migration 038 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '038_preflight: ALREADY_CORRECT — FULL READY (reason_code=MARKETPLACE_PORTAL_SCHEMA_READY)';
  END IF;
END
$preflight$;
