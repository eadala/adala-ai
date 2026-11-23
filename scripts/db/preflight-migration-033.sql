-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 033 — READ-ONLY checks for Document V2 schema
--
-- This script only reads catalogs/data and emits notices. It does not
-- CREATE / ALTER / DROP durable objects.
--
-- Strict decision ladder:
--   1. Inspect every present 033-owned object.
--   2. Collect blockers across all present objects.
--   3. Any blocker wins over every safe repair, including a missing table.
--   4. With no blockers, report SAFE_AUTO_REPAIR for any contract gap;
--      otherwise report ALREADY_CORRECT.
--
-- The documents baseline is the sole early exit: if it is absent, Migration
-- 003 must be applied before any Document V2 repair can be considered.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 033 preflight: object presence'
SELECT
  to_regclass('public.documents') IS NOT NULL AS documents_present,
  to_regclass('public.document_versions') IS NOT NULL AS document_versions_present,
  to_regclass('public.document_permissions') IS NOT NULL AS document_permissions_present,
  to_regclass('public.storage_migration_log') IS NOT NULL AS storage_migration_log_present,
  to_regclass('public.document_retention_policies') IS NOT NULL AS document_retention_policies_present,
  to_regclass('public.retention_policies') IS NOT NULL AS compliance_retention_policies_present;

\echo '▶ 033 preflight: full contract and decision'
DO $preflight$
DECLARE
  documents_present BOOLEAN := to_regclass('public.documents') IS NOT NULL;
  dv_present BOOLEAN := to_regclass('public.document_versions') IS NOT NULL;
  dp_present BOOLEAN := to_regclass('public.document_permissions') IS NOT NULL;
  sml_present BOOLEAN := to_regclass('public.storage_migration_log') IS NOT NULL;
  drp_present BOOLEAN := to_regclass('public.document_retention_policies') IS NOT NULL;

  missing_tables TEXT[] := ARRAY[]::TEXT[];
  missing_columns TEXT[] := ARRAY[]::TEXT[];
  missing_defaults TEXT[] := ARRAY[]::TEXT[];
  missing_not_null TEXT[] := ARRAY[]::TEXT[];
  missing_pks TEXT[] := ARRAY[]::TEXT[];
  missing_unique TEXT[] := ARRAY[]::TEXT[];
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  missing_seed_categories TEXT[] := ARRAY[]::TEXT[];
  extra_seed_categories TEXT[] := ARRAY[]::TEXT[];

  incompatible_objects TEXT[] := ARRAY[]::TEXT[];
  incompatible_types TEXT[] := ARRAY[]::TEXT[];
  incompatible_pks TEXT[] := ARRAY[]::TEXT[];
  incompatible_unique TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];
  null_required_details TEXT[] := ARRAY[]::TEXT[];
  duplicate_pk_details TEXT[] := ARRAY[]::TEXT[];

  expected_seed_categories CONSTANT TEXT[] := ARRAY[
    'وكالة',
    'عقد',
    'حكم',
    'مذكرة',
    'لائحة_دعوى',
    'محضر_جلسة',
    'تقرير_خبير',
    'مستند_إفلاس',
    'فاتورة',
    'مستند_مالي',
    'هوية',
    'سجل_تجاري',
    'أخرى'
  ]::TEXT[];

  estimated_documents BIGINT := 0;
  estimated_dv BIGINT := 0;
  estimated_dp BIGINT := 0;
  estimated_sml BIGINT := 0;
  estimated_drp BIGINT := 0;
  null_required_count BIGINT := 0;
  duplicate_pk_groups BIGINT := 0;
  duplicate_retention_groups BIGINT := 0;
  default_seed_rows BIGINT := 0;
  default_seed_expected_rows BIGINT := cardinality(expected_seed_categories);
  missing_id_generation BOOLEAN := false;

  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'LOW';

  table_spec RECORD;
  column_spec RECORD;
  pk_spec RECORD;
  index_spec RECORD;
  actual_relkind "char";
  actual_udt TEXT;
  actual_nullable TEXT;
  actual_default TEXT;
  actual_identity TEXT;
  normalized_default TEXT;
  row_count BIGINT;
  group_count BIGINT;
  pk_exists BOOLEAN;
  pk_cols TEXT[];
  named_unique_exists BOOLEAN;
  named_unique_type "char";
  named_unique_cols TEXT[];
  exact_unique_exists BOOLEAN;
  retention_probe_safe BOOLEAN := false;

  index_oid OID;
  index_relkind "char";
  index_table TEXT;
  index_unique BOOLEAN;
  index_partial BOOLEAN;
  index_expression BOOLEAN;
  index_valid BOOLEAN;
  index_ready BOOLEAN;
  index_cols TEXT[];

  empty_text TEXT;
BEGIN
  /*
   * Migration 003 owns the documents baseline. This is deliberately the only
   * early return; no V2 object can make an absent baseline safe to repair.
   */
  IF NOT documents_present THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'BASELINE_MISSING';
    lock_risk := 'HIGH';

    RAISE NOTICE '033_preflight: chosen_action=% reason_code=%', action, reason_code;
    RAISE NOTICE '033_preflight: lock_risk=%', lock_risk;
    RAISE NOTICE '033_preflight: estimated_rows documents=0 document_versions=0 document_permissions=0 storage_migration_log=0 document_retention_policies=0';
    RAISE NOTICE '033_preflight: incompatible_objects=<not_inspected> incompatible_types=<not_inspected> incompatible_pks=<not_inspected> incompatible_unique=<not_inspected> incompatible_indexes=<not_inspected>';
    RAISE NOTICE '033_preflight: missing_tables=documents missing_columns=<not_inspected> missing_defaults=<not_inspected> missing_not_null=<not_inspected> missing_pks=<not_inspected> missing_unique=<not_inspected> missing_indexes=<not_inspected> missing_id_generation=<not_inspected>';
    RAISE NOTICE '033_preflight: default_seed=<not_inspected> missing_seed_categories=<not_inspected> extra_seed_categories=<not_inspected>';
    RAISE NOTICE '033_preflight: compliance_retention_note=public.retention_policies is compliance-owned, out of scope, and was not inspected or changed';
    RAISE NOTICE '033_preflight: BLOCK — documents baseline missing; apply Migration 003 before Migration 033';
    RETURN;
  END IF;

  IF NOT dv_present THEN
    missing_tables := array_append(missing_tables, 'document_versions');
  END IF;
  IF NOT dp_present THEN
    missing_tables := array_append(missing_tables, 'document_permissions');
  END IF;
  IF NOT sml_present THEN
    missing_tables := array_append(missing_tables, 'storage_migration_log');
  END IF;
  IF NOT drp_present THEN
    missing_tables := array_append(missing_tables, 'document_retention_policies');
  END IF;

  /*
   * Validate relation kinds and collect exact row counts. A same-named view,
   * sequence, or other relation is a blocker because 033 cannot safely turn
   * it into the required table.
   */
  FOR table_spec IN
    SELECT *
    FROM (VALUES
      ('documents'),
      ('document_versions'),
      ('document_permissions'),
      ('storage_migration_log'),
      ('document_retention_policies')
    ) AS required_table(table_name)
  LOOP
    actual_relkind := NULL;
    SELECT c.relkind
      INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = table_spec.table_name;

    IF FOUND AND actual_relkind NOT IN ('r', 'p') THEN
      incompatible_objects := array_append(
        incompatible_objects,
        format('%s(relkind=%s)', table_spec.table_name, actual_relkind)
      );
    ELSIF FOUND THEN
      EXECUTE format('SELECT count(*) FROM public.%I', table_spec.table_name)
        INTO row_count;
      CASE table_spec.table_name
        WHEN 'documents' THEN estimated_documents := row_count;
        WHEN 'document_versions' THEN estimated_dv := row_count;
        WHEN 'document_permissions' THEN estimated_dp := row_count;
        WHEN 'storage_migration_log' THEN estimated_sml := row_count;
        WHEN 'document_retention_policies' THEN estimated_drp := row_count;
      END CASE;
    END IF;
  END LOOP;

  /*
   * Full 033 column contract. Literal defaults are normalized exactly as:
   * regexp_replace(trim(both from split_part(coalesce(column_default,''), '::', 1)), '''', '', 'g')
   * This makes documents.version DEFAULT 10 incompatible with expected
   * DEFAULT 1 without using a substring match.
   */
  FOR column_spec IN
    SELECT *
    FROM (VALUES
      ('documents', 'storage_key', 'text', FALSE, NULL, NULL),
      ('documents', 'storage_provider', 'text', FALSE, 'literal', 'db_base64'),
      ('documents', 'checksum', 'text', FALSE, NULL, NULL),
      ('documents', 'version', 'int4', FALSE, 'literal', '1'),
      ('documents', 'is_archived', 'bool', FALSE, 'literal', 'false'),
      ('documents', 'legal_category', 'text', FALSE, NULL, NULL),
      ('documents', 'tags', '_text', FALSE, NULL, NULL),
      ('documents', 'migrated_at', 'timestamptz', FALSE, NULL, NULL),
      ('documents', 'file_size', 'int8', FALSE, NULL, NULL),

      ('document_versions', 'id', 'text', TRUE, 'uuid_text', 'gen_random_uuid()'),
      ('document_versions', 'document_id', 'text', TRUE, NULL, NULL),
      ('document_versions', 'office_id', 'text', TRUE, NULL, NULL),
      ('document_versions', 'version_number', 'int4', TRUE, 'literal', '1'),
      ('document_versions', 'storage_key', 'text', FALSE, NULL, NULL),
      ('document_versions', 'storage_provider', 'text', FALSE, 'literal', 'cloudflare_r2'),
      ('document_versions', 'checksum', 'text', FALSE, NULL, NULL),
      ('document_versions', 'file_size', 'int8', FALSE, 'literal', '0'),
      ('document_versions', 'mime_type', 'text', FALSE, NULL, NULL),
      ('document_versions', 'uploaded_by', 'text', FALSE, NULL, NULL),
      ('document_versions', 'uploaded_by_name', 'text', FALSE, NULL, NULL),
      ('document_versions', 'change_summary', 'text', FALSE, NULL, NULL),
      ('document_versions', 'is_current', 'bool', FALSE, 'literal', 'false'),
      ('document_versions', 'created_at', 'timestamptz', FALSE, 'literal', 'now()'),

      ('document_permissions', 'id', 'text', TRUE, 'uuid_text', 'gen_random_uuid()'),
      ('document_permissions', 'document_id', 'text', TRUE, NULL, NULL),
      ('document_permissions', 'office_id', 'text', TRUE, NULL, NULL),
      ('document_permissions', 'permission_type', 'text', TRUE, 'literal', 'TEAM'),
      ('document_permissions', 'role_id', 'text', FALSE, NULL, NULL),
      ('document_permissions', 'user_id', 'text', FALSE, NULL, NULL),
      ('document_permissions', 'created_at', 'timestamptz', FALSE, 'literal', 'now()'),

      ('storage_migration_log', 'id', 'int4', TRUE, 'serial_or_identity', 'nextval/identity'),
      ('storage_migration_log', 'office_id', 'text', TRUE, NULL, NULL),
      ('storage_migration_log', 'table_name', 'text', TRUE, NULL, NULL),
      ('storage_migration_log', 'record_id', 'text', TRUE, NULL, NULL),
      ('storage_migration_log', 'old_provider', 'text', FALSE, 'literal', 'db_base64'),
      ('storage_migration_log', 'new_key', 'text', FALSE, NULL, NULL),
      ('storage_migration_log', 'file_size', 'int8', FALSE, NULL, NULL),
      ('storage_migration_log', 'checksum', 'text', FALSE, NULL, NULL),
      ('storage_migration_log', 'status', 'text', FALSE, 'literal', 'pending'),
      ('storage_migration_log', 'error_msg', 'text', FALSE, NULL, NULL),
      ('storage_migration_log', 'migrated_at', 'timestamptz', FALSE, 'literal', 'now()'),

      ('document_retention_policies', 'id', 'text', TRUE, 'uuid_text', 'gen_random_uuid()'),
      ('document_retention_policies', 'office_id', 'text', TRUE, NULL, NULL),
      ('document_retention_policies', 'category', 'text', TRUE, NULL, NULL),
      ('document_retention_policies', 'retention_years', 'int4', TRUE, 'literal', '7'),
      ('document_retention_policies', 'archive_after_days', 'int4', FALSE, 'literal', '365'),
      ('document_retention_policies', 'auto_delete', 'bool', FALSE, 'literal', 'false'),
      ('document_retention_policies', 'created_at', 'timestamptz', FALSE, 'literal', 'now()'),
      ('document_retention_policies', 'updated_at', 'timestamptz', FALSE, 'literal', 'now()')
    ) AS expected_column(
      table_name,
      column_name,
      expected_udt,
      required_not_null,
      default_kind,
      expected_default
    )
  LOOP
    /* Skip missing/non-table relations; their table/object result is enough. */
    SELECT c.relkind
      INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = column_spec.table_name;
    IF NOT FOUND OR actual_relkind NOT IN ('r', 'p') THEN
      CONTINUE;
    END IF;

    actual_udt := NULL;
    actual_nullable := NULL;
    actual_default := NULL;
    actual_identity := NULL;
    SELECT c.udt_name, c.is_nullable, c.column_default, c.is_identity
      INTO actual_udt, actual_nullable, actual_default, actual_identity
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
        format(
          '%s.%s(expected=%s,actual=%s)',
          column_spec.table_name,
          column_spec.column_name,
          column_spec.expected_udt,
          coalesce(actual_udt, '<null>')
        )
      );
    END IF;

    IF column_spec.required_not_null THEN
      IF actual_nullable IS DISTINCT FROM 'NO' THEN
        missing_not_null := array_append(
          missing_not_null,
          format('%s.%s', column_spec.table_name, column_spec.column_name)
        );
      END IF;

      /*
       * IS NULL is type-independent. Dynamic identifiers are sourced only
       * from the constant contract above and execute only after the column
       * has been confirmed present.
       */
      EXECUTE format(
        'SELECT count(*) FROM public.%I WHERE %I IS NULL',
        column_spec.table_name,
        column_spec.column_name
      ) INTO row_count;
      IF row_count > 0 THEN
        null_required_count := null_required_count + row_count;
        null_required_details := array_append(
          null_required_details,
          format('%s.%s=%s', column_spec.table_name, column_spec.column_name, row_count)
        );
      END IF;
    END IF;

    IF column_spec.default_kind = 'literal' THEN
      normalized_default := regexp_replace(
        trim(both from split_part(coalesce(actual_default, ''), '::', 1)),
        '''',
        '',
        'g'
      );
      IF normalized_default IS DISTINCT FROM column_spec.expected_default THEN
        missing_defaults := array_append(
          missing_defaults,
          format(
            '%s.%s(expected=%s,actual=%s)',
            column_spec.table_name,
            column_spec.column_name,
            column_spec.expected_default,
            coalesce(nullif(normalized_default, ''), '<none>')
          )
        );
      END IF;
    ELSIF column_spec.default_kind = 'uuid_text' THEN
      IF coalesce(actual_default, '') NOT ILIKE '%gen_random_uuid%' THEN
        missing_defaults := array_append(
          missing_defaults,
          format('%s.%s(expected=gen_random_uuid,actual=%s)',
            column_spec.table_name,
            column_spec.column_name,
            coalesce(actual_default, '<none>'))
        );
      END IF;
    ELSIF column_spec.default_kind = 'serial_or_identity' THEN
      IF actual_udt = 'int4'
         AND NOT (
           coalesce(actual_default, '') ILIKE '%nextval%'
           OR actual_identity = 'YES'
         ) THEN
        missing_id_generation := true;
      END IF;
    END IF;
  END LOOP;

  /*
   * Every V2 table requires PRIMARY KEY (id). An absent PK is a safe schema
   * gap when id data is clean; an existing PK of another shape is a blocker.
   * Duplicate id groups are collected before the decision ladder so a later
   * ADD PRIMARY KEY cannot fail unexpectedly.
   */
  FOR pk_spec IN
    SELECT *
    FROM (VALUES
      ('document_versions', 'text'),
      ('document_permissions', 'text'),
      ('storage_migration_log', 'int4'),
      ('document_retention_policies', 'text')
    ) AS expected_pk(table_name, id_udt)
  LOOP
    SELECT c.relkind
      INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = pk_spec.table_name;
    IF NOT FOUND OR actual_relkind NOT IN ('r', 'p') THEN
      CONTINUE;
    END IF;

    pk_exists := EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', pk_spec.table_name))
        AND c.contype = 'p'
    );
    pk_cols := NULL;
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
      WHERE c.conrelid = to_regclass(format('public.%I', pk_spec.table_name))
        AND c.contype = 'p'
      LIMIT 1;

      IF pk_cols IS DISTINCT FROM ARRAY['id']::TEXT[] THEN
        incompatible_pks := array_append(
          incompatible_pks,
          format('%s(expected={id},actual=%s)', pk_spec.table_name, coalesce(pk_cols::TEXT, '<null>'))
        );
      END IF;
    ELSE
      missing_pks := array_append(missing_pks, format('%s(id)', pk_spec.table_name));
    END IF;

    SELECT c.udt_name
      INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = pk_spec.table_name
      AND c.column_name = 'id';
    IF FOUND AND actual_udt = pk_spec.id_udt THEN
      EXECUTE format(
        'SELECT count(*) FROM (
           SELECT id
           FROM public.%I
           WHERE id IS NOT NULL
           GROUP BY id
           HAVING count(*) > 1
         ) duplicate_ids',
        pk_spec.table_name
      ) INTO group_count;
      IF group_count > 0 THEN
        duplicate_pk_groups := duplicate_pk_groups + group_count;
        duplicate_pk_details := array_append(
          duplicate_pk_details,
          format('%s.id=%s_group(s)', pk_spec.table_name, group_count)
        );
      END IF;
    END IF;
  END LOOP;

  /*
   * Named required indexes must be ordinary NON-UNIQUE, non-partial,
   * non-expression, valid, ready indexes with exactly the listed columns.
   * A same-named index on another table is incompatible, not missing.
   */
  FOR index_spec IN
    SELECT *
    FROM (VALUES
      ('idx_dv_doc_id', 'document_versions', ARRAY['document_id']::TEXT[]),
      ('idx_dv_doc_ver', 'document_versions', ARRAY['document_id', 'version_number']::TEXT[]),
      ('idx_dv_office', 'document_versions', ARRAY['office_id']::TEXT[]),
      ('idx_dp_doc_id', 'document_permissions', ARRAY['document_id']::TEXT[]),
      ('idx_dp_office', 'document_permissions', ARRAY['office_id']::TEXT[]),
      ('idx_sml_office_status', 'storage_migration_log', ARRAY['office_id', 'status']::TEXT[]),
      ('idx_drp_office', 'document_retention_policies', ARRAY['office_id']::TEXT[])
    ) AS expected_index(index_name, table_name, expected_cols)
  LOOP
    index_oid := NULL;
    index_relkind := NULL;
    index_table := NULL;
    index_unique := NULL;
    index_partial := NULL;
    index_expression := NULL;
    index_valid := NULL;
    index_ready := NULL;
    index_cols := NULL;

    SELECT
      i.oid,
      i.relkind,
      t.relname,
      x.indisunique,
      x.indpred IS NOT NULL,
      x.indexprs IS NOT NULL,
      x.indisvalid,
      x.indisready,
      (
        SELECT array_agg(a.attname::TEXT ORDER BY key_col.ordinality)
        FROM unnest(x.indkey::SMALLINT[]) WITH ORDINALITY AS key_col(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid
         AND a.attnum = key_col.attnum
         AND NOT a.attisdropped
      )
      INTO
        index_oid,
        index_relkind,
        index_table,
        index_unique,
        index_partial,
        index_expression,
        index_valid,
        index_ready,
        index_cols
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    LEFT JOIN pg_class t ON t.oid = x.indrelid
    WHERE n.nspname = 'public'
      AND i.relname = index_spec.index_name;

    IF NOT FOUND THEN
      missing_indexes := array_append(missing_indexes, index_spec.index_name);
    ELSIF index_relkind NOT IN ('i', 'I')
       OR index_table IS DISTINCT FROM index_spec.table_name
       OR index_unique IS DISTINCT FROM FALSE
       OR index_partial IS DISTINCT FROM FALSE
       OR index_expression IS DISTINCT FROM FALSE
       OR index_valid IS DISTINCT FROM TRUE
       OR index_ready IS DISTINCT FROM TRUE
       OR index_cols IS DISTINCT FROM index_spec.expected_cols THEN
      incompatible_indexes := array_append(
        incompatible_indexes,
        format(
          '%s(table=%s,cols=%s,unique=%s,partial=%s,expression=%s,valid=%s,ready=%s)',
          index_spec.index_name,
          coalesce(index_table, '<none>'),
          coalesce(index_cols::TEXT, '<none>'),
          coalesce(index_unique::TEXT, '<null>'),
          coalesce(index_partial::TEXT, '<null>'),
          coalesce(index_expression::TEXT, '<null>'),
          coalesce(index_valid::TEXT, '<null>'),
          coalesce(index_ready::TEXT, '<null>')
        )
      );
    END IF;
  END LOOP;

  /*
   * Retention uniqueness must be a pg_constraint UNIQUE exactly on
   * (office_id, category). A standalone unique index does not satisfy the
   * contract. The expected constraint name with any other shape blocks.
   */
  IF drp_present THEN
    SELECT c.relkind
      INTO actual_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'document_retention_policies';

    IF FOUND AND actual_relkind IN ('r', 'p') THEN
      named_unique_exists := false;
      named_unique_type := NULL;
      named_unique_cols := NULL;
      SELECT
        true,
        c.contype,
        ARRAY(
          SELECT a.attname::TEXT
          FROM unnest(c.conkey) WITH ORDINALITY AS unique_col(attnum, ordinality)
          JOIN pg_attribute a
            ON a.attrelid = c.conrelid
           AND a.attnum = unique_col.attnum
           AND NOT a.attisdropped
          ORDER BY unique_col.ordinality
        )
        INTO named_unique_exists, named_unique_type, named_unique_cols
      FROM pg_constraint c
      WHERE c.conrelid = 'public.document_retention_policies'::regclass
        AND c.conname = 'document_retention_policies_office_id_category_key';

      IF named_unique_exists
         AND (
           named_unique_type IS DISTINCT FROM 'u'
           OR named_unique_cols IS DISTINCT FROM ARRAY['office_id', 'category']::TEXT[]
         ) THEN
        incompatible_unique := array_append(
          incompatible_unique,
          format(
            'document_retention_policies_office_id_category_key(type=%s,cols=%s)',
            coalesce(named_unique_type::TEXT, '<null>'),
            coalesce(named_unique_cols::TEXT, '<null>')
          )
        );
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.document_retention_policies'::regclass
          AND c.contype = 'u'
          AND ARRAY(
            SELECT a.attname::TEXT
            FROM unnest(c.conkey) WITH ORDINALITY AS unique_col(attnum, ordinality)
            JOIN pg_attribute a
              ON a.attrelid = c.conrelid
             AND a.attnum = unique_col.attnum
             AND NOT a.attisdropped
            ORDER BY unique_col.ordinality
          ) = ARRAY['office_id', 'category']::TEXT[]
      ) INTO exact_unique_exists;

      IF NOT exact_unique_exists THEN
        missing_unique := array_append(
          missing_unique,
          'document_retention_policies(office_id,category)'
        );
      END IF;

      retention_probe_safe :=
        EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'document_retention_policies'
            AND c.column_name = 'office_id'
            AND c.udt_name = 'text'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'document_retention_policies'
            AND c.column_name = 'category'
            AND c.udt_name = 'text'
        );

      IF retention_probe_safe THEN
        SELECT count(*)
          INTO duplicate_retention_groups
        FROM (
          SELECT office_id, category
          FROM public.document_retention_policies
          GROUP BY office_id, category
          HAVING count(*) > 1
        ) duplicate_retention_keys;

        SELECT count(*)
          INTO default_seed_rows
        FROM public.document_retention_policies
        WHERE office_id = '__default__';

        SELECT coalesce(array_agg(expected.category ORDER BY expected.ordinality), ARRAY[]::TEXT[])
          INTO missing_seed_categories
        FROM unnest(expected_seed_categories) WITH ORDINALITY AS expected(category, ordinality)
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.document_retention_policies actual
          WHERE actual.office_id = '__default__'
            AND actual.category = expected.category
        );

        SELECT coalesce(array_agg(extra.category ORDER BY extra.category), ARRAY[]::TEXT[])
          INTO extra_seed_categories
        FROM (
          SELECT DISTINCT actual.category
          FROM public.document_retention_policies actual
          WHERE actual.office_id = '__default__'
            AND actual.category IS NOT NULL
            AND NOT (actual.category = ANY(expected_seed_categories))
        ) extra;
      ELSE
        missing_seed_categories := expected_seed_categories;
      END IF;
    ELSE
      missing_seed_categories := expected_seed_categories;
    END IF;
  ELSE
    missing_seed_categories := expected_seed_categories;
  END IF;

  /*
   * Blockers are evaluated only after every present object has been
   * inspected. This ordering is intentional: a missing table never masks an
   * incompatible type/index/constraint or unsafe data in another table.
   */
  IF cardinality(incompatible_objects) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_OBJECT';
    lock_risk := 'HIGH';
  ELSIF cardinality(incompatible_types) > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
    lock_risk := 'HIGH';
  ELSIF null_required_count > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'NULL_REQUIRED';
    lock_risk := 'HIGH';
  ELSIF duplicate_retention_groups > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_RETENTION_KEY';
    lock_risk := 'HIGH';
  ELSIF duplicate_pk_groups > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_PRIMARY_KEY';
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

  /* Safe repair reasons are considered only after all blockers are absent. */
  ELSIF cardinality(missing_tables) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'TABLE_MISSING';
    lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_columns) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'MEDIUM';
  ELSIF missing_id_generation THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'MISSING_ID_GENERATION';
    lock_risk := 'LOW';
  ELSIF cardinality(missing_defaults) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'MISSING_COLUMN_DEFAULTS';
    lock_risk := 'LOW';
  ELSIF cardinality(missing_not_null) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'SET_NOT_NULL_PENDING';
    lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_pks) > 0
     OR cardinality(missing_unique) > 0
     OR cardinality(missing_indexes) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'MEDIUM';
  ELSIF cardinality(missing_seed_categories) > 0 THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'DEFAULT_SEED_PENDING';
    lock_risk := 'LOW';
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'DOCUMENT_V2_SCHEMA_READY';
    lock_risk := 'LOW';
  END IF;

  empty_text := '<none>';
  RAISE NOTICE '033_preflight: objects documents=% document_versions=% document_permissions=% storage_migration_log=% document_retention_policies=%',
    documents_present, dv_present, dp_present, sml_present, drp_present;
  RAISE NOTICE '033_preflight: estimated_rows documents=% document_versions=% document_permissions=% storage_migration_log=% document_retention_policies=%',
    estimated_documents, estimated_dv, estimated_dp, estimated_sml, estimated_drp;

  RAISE NOTICE '033_preflight: incompatible_objects=%',
    coalesce(nullif(array_to_string(incompatible_objects, ','), ''), empty_text);
  RAISE NOTICE '033_preflight: incompatible_types=%',
    coalesce(nullif(array_to_string(incompatible_types, ','), ''), empty_text);
  RAISE NOTICE '033_preflight: incompatible_pks=% incompatible_unique=% incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_pks, ','), ''), empty_text),
    coalesce(nullif(array_to_string(incompatible_unique, ','), ''), empty_text),
    coalesce(nullif(array_to_string(incompatible_indexes, ','), ''), empty_text);
  RAISE NOTICE '033_preflight: null_required=% null_required_details=% duplicate_primary_key_groups=% duplicate_primary_key_details=% duplicate_retention_groups=%',
    null_required_count,
    coalesce(nullif(array_to_string(null_required_details, ','), ''), empty_text),
    duplicate_pk_groups,
    coalesce(nullif(array_to_string(duplicate_pk_details, ','), ''), empty_text),
    duplicate_retention_groups;

  RAISE NOTICE '033_preflight: missing_tables=%',
    coalesce(nullif(array_to_string(missing_tables, ','), ''), empty_text);
  RAISE NOTICE '033_preflight: missing_columns=%',
    coalesce(nullif(array_to_string(missing_columns, ','), ''), empty_text);
  RAISE NOTICE '033_preflight: missing_defaults=% missing_not_null=% missing_id_generation=%',
    coalesce(nullif(array_to_string(missing_defaults, ','), ''), empty_text),
    coalesce(nullif(array_to_string(missing_not_null, ','), ''), empty_text),
    missing_id_generation;
  RAISE NOTICE '033_preflight: missing_pks=% missing_unique=% missing_indexes=%',
    coalesce(nullif(array_to_string(missing_pks, ','), ''), empty_text),
    coalesce(nullif(array_to_string(missing_unique, ','), ''), empty_text),
    coalesce(nullif(array_to_string(missing_indexes, ','), ''), empty_text);

  RAISE NOTICE '033_preflight: default_seed_rows=% default_seed_expected_rows=% default_seed=__default__',
    default_seed_rows, default_seed_expected_rows;
  RAISE NOTICE '033_preflight: missing_seed_categories=% extra_seed_categories=%',
    coalesce(nullif(array_to_string(missing_seed_categories, ','), ''), empty_text),
    coalesce(nullif(array_to_string(extra_seed_categories, ','), ''), empty_text);
  RAISE NOTICE '033_preflight: compliance_retention_note=public.retention_policies is compliance-owned, out of scope, and was not inspected or changed';
  RAISE NOTICE '033_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '033_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '033_preflight: BLOCK — do not apply Migration 033 until every reported blocker is resolved';
  ELSIF action = 'SAFE_AUTO_REPAIR' THEN
    RAISE NOTICE '033_preflight: SAFE_AUTO_REPAIR — Migration 033 may repair the reported non-blocking gaps';
  ELSE
    RAISE NOTICE '033_preflight: ALREADY_CORRECT — Migration 033 is expected to be an idempotent no-op';
  END IF;
END
$preflight$;
