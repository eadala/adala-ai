-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 037 — READ-ONLY checks for Remaining Financial schema
--
-- This script reads catalogs/data and emits notices only. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Owned tables (8):
--   financial_accounts, ledger_entries, wallets, lawyer_payouts,
--   invoice_payments, office_tax_settings, invoice_revisions, credit_notes
-- Extension surfaces (003-owned bases):
--   client_invoices extensions + revenues.deleted_at + expenses.deleted_at
-- Sequence: invoice_seq
-- Indexes are ALWAYS probed by name (even when the expected table is missing).
--
-- Blockers are collected before the decision ladder. Any blocker wins over
-- every safe repair, including missing tables.
--
-- Reason codes:
--   INCOMPATIBLE_TYPE, NULL_OFFICE_ID, NON_UUID_OFFICE_ID, NULL_REQUIRED,
--   INCOMPATIBLE_PK, INCOMPATIBLE_UNIQUE, INCOMPATIBLE_INDEX, DUPLICATE_UNIQUE_KEY,
--   CHECK_VIOLATION, MISSING_BASE_TABLE
--   FINANCIAL_REMAINING_SCHEMA_READY means ALREADY_CORRECT.
--
-- On BLOCK: RAISE EXCEPTION so ON_ERROR_STOP scripts fail closed.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 037 preflight: object presence'
SELECT
  to_regclass('public.financial_accounts') IS NOT NULL AS financial_accounts_present,
  to_regclass('public.ledger_entries') IS NOT NULL AS ledger_entries_present,
  to_regclass('public.wallets') IS NOT NULL AS wallets_present,
  to_regclass('public.lawyer_payouts') IS NOT NULL AS lawyer_payouts_present,
  to_regclass('public.invoice_payments') IS NOT NULL AS invoice_payments_present,
  to_regclass('public.office_tax_settings') IS NOT NULL AS office_tax_settings_present,
  to_regclass('public.invoice_revisions') IS NOT NULL AS invoice_revisions_present,
  to_regclass('public.credit_notes') IS NOT NULL AS credit_notes_present,
  to_regclass('public.client_invoices') IS NOT NULL AS client_invoices_present,
  to_regclass('public.revenues') IS NOT NULL AS revenues_present,
  to_regclass('public.expenses') IS NOT NULL AS expenses_present,
  EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='invoice_seq' AND c.relkind='S'
  ) AS invoice_seq_present;

\echo '▶ 037 preflight: full contract and decision'
DO $preflight$
DECLARE
  uuid_re CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  owned_tables CONSTANT TEXT[] := ARRAY[
    'financial_accounts','ledger_entries','wallets','lawyer_payouts',
    'invoice_payments','office_tax_settings','invoice_revisions','credit_notes'
  ]::TEXT[];
  tenant_office_tables CONSTANT TEXT[] := ARRAY[
    'lawyer_payouts','invoice_payments','office_tax_settings',
    'invoice_revisions','credit_notes'
  ]::TEXT[];

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_defaults TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_uniques TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  missing_sequence TEXT[] := ARRAY[]::TEXT[];
  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_uniques TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  null_office_details TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  non_uuid_details TEXT[] := ARRAY[]::TEXT[];
  duplicate_details TEXT[] := ARRAY[]::TEXT[];
  check_violation_details TEXT[] := ARRAY[]::TEXT[];

  estimated_rows BIGINT[] := ARRAY[0,0,0,0,0,0,0,0]::BIGINT[];
  null_office_count BIGINT := 0;
  null_required_count BIGINT := 0;
  non_uuid_count BIGINT := 0;
  duplicate_count BIGINT := 0;
  check_violation_count BIGINT := 0;
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
  has_uq BOOLEAN;
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='invoice_seq' AND c.relkind='S'
  ) THEN
    missing_sequence := array_append(missing_sequence, 'invoice_seq');
  END IF;

  FOREACH tbl IN ARRAY ARRAY['client_invoices','revenues','expenses'] LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      incompatible_objects := array_append(incompatible_objects, format('%s(MISSING_BASE_TABLE)', tbl));
    END IF;
  END LOOP;

  FOR column_spec IN
    SELECT * FROM (VALUES
      ('financial_accounts','id','uuid',TRUE,'uuid',NULL),
      ('financial_accounts','owner_id','text',TRUE,NULL,NULL),
      ('financial_accounts','owner_type','text',TRUE,'literal','office'),
      ('financial_accounts','currency','text',TRUE,'literal','SAR'),
      ('financial_accounts','balance','numeric',TRUE,'literal','0'),
      ('financial_accounts','frozen_balance','numeric',TRUE,'literal','0'),
      ('financial_accounts','created_at','timestamp',FALSE,'now',NULL),
      ('financial_accounts','updated_at','timestamp',FALSE,'now',NULL),
      ('ledger_entries','id','uuid',TRUE,'uuid',NULL),
      ('ledger_entries','debit_account','text',TRUE,NULL,NULL),
      ('ledger_entries','credit_account','text',TRUE,NULL,NULL),
      ('ledger_entries','amount','numeric',TRUE,NULL,NULL),
      ('ledger_entries','currency','text',TRUE,'literal','SAR'),
      ('ledger_entries','entry_type','text',FALSE,'literal','payment'),
      ('ledger_entries','created_at','timestamp',FALSE,'now',NULL),
      ('ledger_entries','office_id','text',FALSE,NULL,NULL),
      ('wallets','id','uuid',TRUE,'uuid',NULL),
      ('wallets','owner_id','text',TRUE,NULL,NULL),
      ('wallets','available_balance','numeric',TRUE,'literal','0'),
      ('wallets','pending_balance','numeric',TRUE,'literal','0'),
      ('wallets','total_earned','numeric',TRUE,'literal','0'),
      ('wallets','total_withdrawn','numeric',TRUE,'literal','0'),
      ('wallets','currency','text',TRUE,'literal','SAR'),
      ('wallets','created_at','timestamp',FALSE,'now',NULL),
      ('wallets','updated_at','timestamp',FALSE,'now',NULL),
      ('lawyer_payouts','id','uuid',TRUE,'uuid',NULL),
      ('lawyer_payouts','office_id','text',TRUE,NULL,NULL),
      ('lawyer_payouts','amount','numeric',TRUE,NULL,NULL),
      ('lawyer_payouts','platform_fee','numeric',TRUE,'literal','0'),
      ('lawyer_payouts','net_amount','numeric',TRUE,NULL,NULL),
      ('lawyer_payouts','status','text',TRUE,'literal','pending'),
      ('lawyer_payouts','provider','text',FALSE,'literal','manual'),
      ('lawyer_payouts','transaction_ids','_text',FALSE,NULL,NULL),
      ('lawyer_payouts','created_at','timestamp',FALSE,'now',NULL),
      ('lawyer_payouts','updated_at','timestamp',FALSE,'now',NULL),
      ('invoice_payments','id','uuid',TRUE,'uuid',NULL),
      ('invoice_payments','invoice_id','uuid',TRUE,NULL,NULL),
      ('invoice_payments','office_id','text',TRUE,NULL,NULL),
      ('invoice_payments','amount','numeric',TRUE,NULL,NULL),
      ('invoice_payments','method','text',TRUE,'literal','bank'),
      ('invoice_payments','paid_at','timestamp',TRUE,'now',NULL),
      ('invoice_payments','created_at','timestamp',TRUE,'now',NULL),
      ('office_tax_settings','id','text',TRUE,'uuid_text',NULL),
      ('office_tax_settings','office_id','text',TRUE,NULL,NULL),
      ('office_tax_settings','tax_enabled','bool',TRUE,'literal','true'),
      ('office_tax_settings','tax_rate','numeric',TRUE,'literal','15'),
      ('office_tax_settings','tax_type','text',TRUE,'literal','VAT'),
      ('office_tax_settings','tax_exempt','bool',TRUE,'literal','false'),
      ('office_tax_settings','zatca_enabled','bool',TRUE,'literal','false'),
      ('office_tax_settings','updated_at','timestamptz',TRUE,'now',NULL),
      ('invoice_revisions','id','text',TRUE,'uuid_text',NULL),
      ('invoice_revisions','invoice_id','text',TRUE,NULL,NULL),
      ('invoice_revisions','office_id','text',TRUE,NULL,NULL),
      ('invoice_revisions','version','int4',TRUE,'literal','1'),
      ('invoice_revisions','changed_by','text',TRUE,NULL,NULL),
      ('invoice_revisions','change_type','text',TRUE,'literal','edit'),
      ('invoice_revisions','snapshot','jsonb',TRUE,NULL,NULL),
      ('invoice_revisions','changed_at','timestamptz',TRUE,'now',NULL),
      ('credit_notes','id','text',TRUE,'uuid_text',NULL),
      ('credit_notes','office_id','text',TRUE,NULL,NULL),
      ('credit_notes','original_invoice_id','text',TRUE,NULL,NULL),
      ('credit_notes','credit_number','text',TRUE,NULL,NULL),
      ('credit_notes','amount','numeric',TRUE,NULL,NULL),
      ('credit_notes','tax_amount','numeric',TRUE,'literal','0'),
      ('credit_notes','total','numeric',TRUE,NULL,NULL),
      ('credit_notes','reason','text',TRUE,NULL,NULL),
      ('credit_notes','status','text',TRUE,'literal','issued'),
      ('credit_notes','issued_at','timestamptz',TRUE,'now',NULL),
      ('client_invoices','client_name','text',FALSE,NULL,NULL),
      ('client_invoices','tax_enabled','bool',FALSE,'literal','true'),
      ('client_invoices','amount_paid','numeric',TRUE,'literal','0'),
      ('client_invoices','view_token','uuid',FALSE,'uuid',NULL),
      ('client_invoices','zatca_uuid','text',FALSE,NULL,NULL),
      ('client_invoices','qr_code_data','text',FALSE,NULL,NULL),
      ('client_invoices','locked_at','timestamptz',FALSE,NULL,NULL),
      ('client_invoices','linked_credit_note_id','text',FALSE,NULL,NULL),
      ('revenues','deleted_at','timestamptz',FALSE,NULL,NULL),
      ('expenses','deleted_at','timestamptz',FALSE,NULL,NULL),
      ('expenses','case_id','text',FALSE,NULL,NULL)
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
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY tenant_office_tables LOOP
    SELECT c.relkind INTO actual_relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=tbl;
    IF NOT FOUND OR actual_relkind NOT IN ('r','p') THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=tbl
        AND c.column_name='office_id' AND c.udt_name='text'
    ) THEN
      BEGIN
        EXECUTE format(
          $q$SELECT count(*) FROM public.%I
             WHERE office_id IS NOT NULL AND office_id !~ %L$q$,tbl,uuid_re
        ) INTO row_count;
        IF row_count > 0 THEN
          non_uuid_count := non_uuid_count + row_count;
          non_uuid_details := array_append(non_uuid_details,format('%s=%s',tbl,row_count));
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
      END;
    END IF;
  END LOOP;

  IF to_regclass('public.ledger_entries') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ledger_entries'
         AND column_name='office_id' AND udt_name='text'
     ) THEN
    BEGIN
      EXECUTE format(
        $q$SELECT count(*) FROM public.ledger_entries
           WHERE office_id IS NOT NULL AND office_id !~ %L$q$, uuid_re
      ) INTO row_count;
      IF row_count > 0 THEN
        non_uuid_count := non_uuid_count + row_count;
        non_uuid_details := array_append(non_uuid_details,format('ledger_entries=%s',row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;

  IF to_regclass('public.financial_accounts') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT owner_id, currency FROM public.financial_accounts
        GROUP BY owner_id, currency HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('financial_accounts(owner_id,currency)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;
  IF to_regclass('public.wallets') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT owner_id FROM public.wallets GROUP BY owner_id HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('wallets(owner_id)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;
  IF to_regclass('public.office_tax_settings') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM (
        SELECT office_id FROM public.office_tax_settings GROUP BY office_id HAVING COUNT(*) > 1
      ) d$q$ INTO row_count;
      IF row_count > 0 THEN
        duplicate_count := duplicate_count + row_count;
        duplicate_details := array_append(duplicate_details, format('office_tax_settings(office_id)=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;

  IF to_regclass('public.invoice_payments') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='invoice_payments' AND column_name='amount'
     ) THEN
    BEGIN
      EXECUTE $q$SELECT count(*) FROM public.invoice_payments WHERE amount IS NOT NULL AND amount <= 0$q$ INTO row_count;
      IF row_count > 0 THEN
        check_violation_count := check_violation_count + row_count;
        check_violation_details := array_append(check_violation_details, format('invoice_payments.amount<=0=%s', row_count));
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;
  END IF;

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

  IF to_regclass('public.financial_accounts') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.financial_accounts'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'owner_id' AND pg_get_constraintdef(c.oid) ~* 'currency'
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      JOIN pg_class i ON i.oid=x.indexrelid
      JOIN pg_namespace n ON n.oid=i.relnamespace
      WHERE n.nspname='public' AND x.indrelid='public.financial_accounts'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['owner_id','currency']::text[]
    ) INTO has_uq;
    IF NOT has_uq THEN
      missing_uniques := array_append(missing_uniques, 'financial_accounts(owner_id,currency)');
    END IF;
  END IF;

  IF to_regclass('public.wallets') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.wallets'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*owner_id\s*\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      JOIN pg_class i ON i.oid=x.indexrelid
      JOIN pg_namespace n ON n.oid=i.relnamespace
      WHERE n.nspname='public' AND x.indrelid='public.wallets'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['owner_id']::text[]
    ) INTO has_uq;
    IF NOT has_uq THEN
      missing_uniques := array_append(missing_uniques, 'wallets(owner_id)');
    END IF;
  END IF;

  IF to_regclass('public.office_tax_settings') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.office_tax_settings'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)' AND pg_get_constraintdef(c.oid) !~* ','
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      JOIN pg_class i ON i.oid=x.indexrelid
      JOIN pg_namespace n ON n.oid=i.relnamespace
      WHERE n.nspname='public' AND x.indrelid='public.office_tax_settings'::regclass
        AND x.indisunique AND NOT x.indisprimary
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['office_id']::text[]
    ) INTO has_uq;
    IF NOT has_uq THEN
      missing_uniques := array_append(missing_uniques, 'office_tax_settings(office_id)');
    END IF;
  END IF;

  -- Indexes ALWAYS probed by name (even when intended target table is missing)
  FOR index_spec IN
    SELECT * FROM (VALUES
      ('idx_inv_payments_invoice','invoice_payments',ARRAY['invoice_id']::TEXT[]),
      ('idx_inv_payments_office','invoice_payments',ARRAY['office_id']::TEXT[]),
      ('idx_invoice_revisions_invoice','invoice_revisions',ARRAY['invoice_id']::TEXT[]),
      ('idx_credit_notes_office','credit_notes',ARRAY['office_id']::TEXT[]),
      ('idx_invoices_case_office','client_invoices',ARRAY['case_id','office_id']::TEXT[]),
      ('idx_revenues_case_office','revenues',ARRAY['case_id','office_id']::TEXT[]),
      ('idx_expenses_case_office','expenses',ARRAY['case_id','office_id']::TEXT[])
    ) AS expected_index(index_name,table_name,expected_cols)
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

  -- Any blocker wins over every safe repair, including missing tables.
  IF cardinality(incompatible_objects)>0 OR cardinality(incompatible_types)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_TYPE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_pks)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_PK'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_uniques)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_UNIQUE'; lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_indexes)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_INDEX'; lock_risk := 'HIGH';
  ELSIF duplicate_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'DUPLICATE_UNIQUE_KEY'; lock_risk := 'HIGH';
  ELSIF check_violation_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'CHECK_VIOLATION'; lock_risk := 'HIGH';
  ELSIF null_office_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_OFFICE_ID'; lock_risk := 'HIGH';
  ELSIF null_required_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NULL_REQUIRED'; lock_risk := 'HIGH';
  ELSIF non_uuid_count>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'NON_UUID_OFFICE_ID'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_tables)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'TABLE_MISSING'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns)>0 OR cardinality(missing_pks)>0
     OR cardinality(missing_indexes)>0 OR cardinality(missing_uniques)>0
     OR cardinality(missing_sequence)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'PARTIAL_SCHEMA'; lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_defaults)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_COLUMN_DEFAULTS'; lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'SET_NOT_NULL_PENDING'; lock_risk := 'MEDIUM';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'FINANCIAL_REMAINING_SCHEMA_READY'; lock_risk := 'LOW';
  END IF;

  FOR tbl_idx IN 1..cardinality(owned_tables) LOOP
    IF tbl_idx>1 THEN rows_notice := rows_notice || ' '; END IF;
    rows_notice := rows_notice || owned_tables[tbl_idx] || '=' || estimated_rows[tbl_idx]::TEXT;
  END LOOP;
  RAISE NOTICE '037_preflight: estimated_rows %',rows_notice;
  RAISE NOTICE '037_preflight: lock_risk=%',lock_risk;
  RAISE NOTICE '037_preflight: non_uuid_office_id_count=% details=%',non_uuid_count,
    coalesce(nullif(array_to_string(non_uuid_details,','),''),empty_text);
  RAISE NOTICE '037_preflight: null_office_id_count=% details=%',null_office_count,
    coalesce(nullif(array_to_string(null_office_details,','),''),empty_text);
  RAISE NOTICE '037_preflight: null_required_count=% details=%',null_required_count,
    coalesce(nullif(array_to_string(null_required_details,','),''),empty_text);
  RAISE NOTICE '037_preflight: duplicate_unique_keys=%',
    coalesce(nullif(array_to_string(duplicate_details,','),''),empty_text);
  RAISE NOTICE '037_preflight: check_violations=%',
    coalesce(nullif(array_to_string(check_violation_details,','),''),empty_text);
  RAISE NOTICE '037_preflight: incompatible_objects=% incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_objects,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_types,','),''),empty_text);
  RAISE NOTICE '037_preflight: incompatible_pks=% incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes,','),''),empty_text);
  RAISE NOTICE '037_preflight: missing_tables=% missing_sequence=%',
    coalesce(nullif(array_to_string(missing_tables,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_sequence,','),''),empty_text);
  RAISE NOTICE '037_preflight: missing_columns=%',coalesce(nullif(array_to_string(missing_columns,','),''),empty_text);
  RAISE NOTICE '037_preflight: missing_defaults=% missing_not_null=%',
    coalesce(nullif(array_to_string(missing_defaults,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_not_null,','),''),empty_text);
  RAISE NOTICE '037_preflight: missing_pks=% missing_uniques=% missing_indexes=%',
    coalesce(nullif(array_to_string(missing_pks,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_uniques,','),''),empty_text),
    coalesce(nullif(array_to_string(missing_indexes,','),''),empty_text);
  RAISE NOTICE '037_preflight: chosen_action=% reason_code=%',action,reason_code;

  IF action='BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '037_preflight: BLOCK — do not apply Migration 037 until every blocker is resolved';
    RAISE EXCEPTION '037_preflight: chosen_action=% reason_code=%',action,reason_code;
  ELSIF action='SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '037_preflight: SAFE_AUTO_REPAIR — Migration 037 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '037_preflight: ALREADY_CORRECT — FULL READY (reason_code=FINANCIAL_REMAINING_SCHEMA_READY)';
  END IF;
END
$preflight$;
