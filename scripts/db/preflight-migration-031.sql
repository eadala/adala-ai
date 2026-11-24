-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 031 — READ-ONLY checks for conversation schema
--
-- Does not CREATE / ALTER / DROP durable objects.
-- Run before applying 031_message_conversations_schema_authority.sql.
--
-- Decision ladder:
--   1. Inspect all existing tables/columns/indexes/constraints/data
--   2. Evaluate blockers (types, NULLs, dups, incompatible same-name indexes)
--   3. Only then SAFE_AUTO_REPAIR for missing safely-fillable objects
--   4. ALREADY_CORRECT only when full greenfield-equivalent contract is present
--
-- chosen_action: ALREADY_CORRECT | SAFE_AUTO_REPAIR | BLOCK_AND_MANUAL_REVIEW
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 031 preflight: table presence'
SELECT
  to_regclass('public.message_conversations') IS NOT NULL AS message_conversations_present,
  to_regclass('public.conversation_members') IS NOT NULL AS conversation_members_present;

\echo '▶ 031 preflight: message_conversations columns'
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'message_conversations'
ORDER BY ordinal_position;

\echo '▶ 031 preflight: conversation_members columns'
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'conversation_members'
ORDER BY ordinal_position;

\echo '▶ 031 preflight: expected column types'
SELECT
  e.table_name, e.column_name, c.udt_name AS actual_udt, e.expected_udt,
  CASE
    WHEN c.udt_name IS NULL THEN 'missing_column'
    WHEN c.udt_name IS DISTINCT FROM e.expected_udt THEN 'differs_from_expected'
    ELSE 'ok'
  END AS status
FROM (
  VALUES
    ('message_conversations', 'id', 'uuid'),
    ('message_conversations', 'office_id', 'text'),
    ('message_conversations', 'title', 'text'),
    ('message_conversations', 'type', 'text'),
    ('message_conversations', 'created_by', 'text'),
    ('message_conversations', 'case_id', 'text'),
    ('message_conversations', 'created_at', 'timestamptz'),
    ('message_conversations', 'updated_at', 'timestamptz'),
    ('conversation_members', 'id', 'uuid'),
    ('conversation_members', 'conversation_id', 'uuid'),
    ('conversation_members', 'office_id', 'text'),
    ('conversation_members', 'user_id', 'text'),
    ('conversation_members', 'user_name', 'text'),
    ('conversation_members', 'role', 'text'),
    ('conversation_members', 'joined_at', 'timestamptz')
) AS e(table_name, column_name, expected_udt)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
ORDER BY e.table_name, e.column_name;

\echo '▶ 031 preflight: PK / CHECK / UNIQUE / FK / indexes / orphans / chosen_action'
DO $$
DECLARE
  mc_present BOOLEAN := to_regclass('public.message_conversations') IS NOT NULL;
  cm_present BOOLEAN := to_regclass('public.conversation_members') IS NOT NULL;

  incompatible_type TEXT := NULL;
  missing_col TEXT := NULL;
  case_id_present BOOLEAN := false;
  case_id_udt TEXT := NULL;
  nullable_needs_set BOOLEAN := false;

  null_req BIGINT := 0;
  dup_cnt BIGINT := 0;
  orphan_cnt BIGINT := 0;
  invalid_check BIGINT := 0;

  has_pk_mc BOOLEAN := false;
  has_pk_cm BOOLEAN := false;
  has_unique BOOLEAN := false;
  has_type_check BOOLEAN := false;
  has_role_check BOOLEAN := false;
  has_fk BOOLEAN := false;

  idx_office_exists BOOLEAN := false;
  idx_office_ok BOOLEAN := false;
  idx_case_exists BOOLEAN := false;
  idx_case_ok BOOLEAN := false;
  idx_case_pred TEXT := NULL;
  idx_updated_exists BOOLEAN := false;
  idx_updated_ok BOOLEAN := false;
  idx_mconv_exists BOOLEAN := false;
  idx_mconv_ok BOOLEAN := false;
  idx_muser_exists BOOLEAN := false;
  idx_muser_ok BOOLEAN := false;
  incompatible_index TEXT := NULL;

  estimated_mc BIGINT := 0;
  estimated_cm BIGINT := 0;
  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'MEDIUM';

  actual_udt TEXT;
  is_nullble TEXT;
  idx_cols TEXT[];
  idx_partial BOOLEAN;
  idx_pred TEXT;
  idx_valid BOOLEAN;
  idx_ready BOOLEAN;
  idx_expr BOOLEAN;
  idx_opts INT[];
BEGIN
  /* ═══════════════════════════════════════════════════════════════════════
     1. INSPECT — never short-circuit before blockers are known
     ═══════════════════════════════════════════════════════════════════════ */

  /* message_conversations columns */
  IF mc_present THEN
    SELECT COUNT(*) INTO estimated_mc FROM message_conversations;

    -- id uuid NOT NULL
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='id';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'message_conversations.id');
    ELSIF actual_udt IS DISTINCT FROM 'uuid' THEN
      incompatible_type := COALESCE(incompatible_type, 'message_conversations.id');
    ELSIF is_nullble = 'YES' THEN
      nullable_needs_set := true;
    END IF;

    -- office_id text NOT NULL
    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='office_id';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'message_conversations.office_id');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'message_conversations.office_id');
    ELSIF is_nullble = 'YES' THEN
      nullable_needs_set := true;
    END IF;

    -- title text nullable
    actual_udt := NULL;
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='title';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'message_conversations.title');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'message_conversations.title');
    END IF;

    -- type text NOT NULL
    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='type';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'message_conversations.type');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'message_conversations.type');
    ELSIF is_nullble = 'YES' THEN
      nullable_needs_set := true;
    END IF;

    -- created_by text NOT NULL
    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='created_by';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'message_conversations.created_by');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'message_conversations.created_by');
    ELSIF is_nullble = 'YES' THEN
      nullable_needs_set := true;
    END IF;

    -- created_at timestamptz NOT NULL
    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='created_at';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'message_conversations.created_at');
    ELSIF actual_udt IS DISTINCT FROM 'timestamptz' THEN
      incompatible_type := COALESCE(incompatible_type, 'message_conversations.created_at');
    ELSIF is_nullble = 'YES' THEN
      nullable_needs_set := true;
    END IF;

    -- updated_at timestamptz NOT NULL
    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='updated_at';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'message_conversations.updated_at');
    ELSIF actual_udt IS DISTINCT FROM 'timestamptz' THEN
      incompatible_type := COALESCE(incompatible_type, 'message_conversations.updated_at');
    ELSIF is_nullble = 'YES' THEN
      nullable_needs_set := true;
    END IF;

    -- case_id text nullable (required column)
    actual_udt := NULL;
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='case_id';
    IF actual_udt IS NULL THEN
      case_id_present := false;
      missing_col := COALESCE(missing_col, 'message_conversations.case_id');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      case_id_present := true;
      case_id_udt := actual_udt;
      incompatible_type := COALESCE(incompatible_type, 'message_conversations.case_id');
    ELSE
      case_id_present := true;
      case_id_udt := 'text';
    END IF;

    /* NULL required identifiers — count when expected-type columns exist */
    null_req := 0;
    SELECT COUNT(*) INTO null_req FROM message_conversations
    WHERE (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='message_conversations' AND column_name='id' AND udt_name='uuid')
           AND id IS NULL)
       OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='message_conversations' AND column_name='office_id' AND udt_name='text')
           AND office_id IS NULL)
       OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='message_conversations' AND column_name='type' AND udt_name='text')
           AND type IS NULL)
       OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='message_conversations' AND column_name='created_by' AND udt_name='text')
           AND created_by IS NULL)
       OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='message_conversations' AND column_name='created_at' AND udt_name='timestamptz')
           AND created_at IS NULL)
       OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='message_conversations' AND column_name='updated_at' AND udt_name='timestamptz')
           AND updated_at IS NULL);

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.message_conversations'::regclass AND c.contype = 'p'
    ) INTO has_pk_mc;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.message_conversations'::regclass
        AND c.contype = 'c' AND c.conname = 'message_conversations_type_check'
    ) INTO has_type_check;

    IF case_id_udt = 'text' OR (
      EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='message_conversations'
                AND column_name='type' AND udt_name='text')
    ) THEN
      SELECT COUNT(*) INTO invalid_check FROM message_conversations
      WHERE type IS NOT NULL AND type NOT IN ('direct', 'group');
    END IF;
  END IF;

  /* conversation_members columns */
  IF cm_present THEN
    SELECT COUNT(*) INTO estimated_cm FROM conversation_members;

    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='id';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'conversation_members.id');
    ELSIF actual_udt IS DISTINCT FROM 'uuid' THEN
      incompatible_type := COALESCE(incompatible_type, 'conversation_members.id');
    ELSE
      IF is_nullble = 'YES' THEN nullable_needs_set := true; END IF;
    END IF;

    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='conversation_id';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'conversation_members.conversation_id');
    ELSIF actual_udt IS DISTINCT FROM 'uuid' THEN
      incompatible_type := COALESCE(incompatible_type, 'conversation_members.conversation_id');
    ELSE
      IF is_nullble = 'YES' THEN nullable_needs_set := true; END IF;
    END IF;

    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='office_id';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'conversation_members.office_id');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'conversation_members.office_id');
    ELSE
      IF is_nullble = 'YES' THEN nullable_needs_set := true; END IF;
    END IF;

    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='user_id';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'conversation_members.user_id');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'conversation_members.user_id');
    ELSE
      IF is_nullble = 'YES' THEN nullable_needs_set := true; END IF;
    END IF;

    actual_udt := NULL;
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='user_name';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'conversation_members.user_name');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'conversation_members.user_name');
    END IF;

    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='role';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'conversation_members.role');
    ELSIF actual_udt IS DISTINCT FROM 'text' THEN
      incompatible_type := COALESCE(incompatible_type, 'conversation_members.role');
    ELSE
      IF is_nullble = 'YES' THEN nullable_needs_set := true; END IF;
    END IF;

    actual_udt := NULL; is_nullble := NULL;
    SELECT c.udt_name, c.is_nullable INTO actual_udt, is_nullble
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='joined_at';
    IF actual_udt IS NULL THEN
      missing_col := COALESCE(missing_col, 'conversation_members.joined_at');
    ELSIF actual_udt IS DISTINCT FROM 'timestamptz' THEN
      incompatible_type := COALESCE(incompatible_type, 'conversation_members.joined_at');
    ELSE
      IF is_nullble = 'YES' THEN nullable_needs_set := true; END IF;
    END IF;

    /* member NULL required ids — count when expected-type columns exist */
    null_req := null_req + (
      SELECT COUNT(*) FROM conversation_members
      WHERE (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_members' AND column_name='id' AND udt_name='uuid')
             AND id IS NULL)
         OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_members' AND column_name='conversation_id' AND udt_name='uuid')
             AND conversation_id IS NULL)
         OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_members' AND column_name='office_id' AND udt_name='text')
             AND office_id IS NULL)
         OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_members' AND column_name='user_id' AND udt_name='text')
             AND user_id IS NULL)
         OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_members' AND column_name='role' AND udt_name='text')
             AND role IS NULL)
         OR (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_members' AND column_name='joined_at' AND udt_name='timestamptz')
             AND joined_at IS NULL)
    );

    /* duplicate membership — evaluate whenever both key columns exist (even if case_id missing) */
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='conversation_members'
        AND column_name='conversation_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='conversation_members'
        AND column_name='user_id'
    ) THEN
      SELECT COUNT(*) INTO dup_cnt FROM (
        SELECT conversation_id, user_id FROM conversation_members
        GROUP BY conversation_id, user_id HAVING COUNT(*) > 1
      ) d;
    END IF;

    IF mc_present THEN
      SELECT COUNT(*) INTO orphan_cnt
      FROM conversation_members cm
      WHERE cm.conversation_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM message_conversations mc WHERE mc.id = cm.conversation_id);
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.conversation_members'::regclass AND c.contype = 'p'
    ) INTO has_pk_cm;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.conversation_members'::regclass
        AND c.contype = 'c' AND c.conname = 'conversation_members_role_check'
    ) INTO has_role_check;

    /* Strict UNIQUE arbiter — same rules as Migration 031 */
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.conversation_members'::regclass
        AND c.contype IN ('u', 'p')
        AND pg_get_constraintdef(c.oid) ILIKE '%(conversation_id, user_id)%'
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = 'public.conversation_members'::regclass
        AND x.indisunique AND x.indisvalid AND x.indisready
        AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indnkeyatts = 2
        AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
            AND NOT a.attisdropped AND a.attname = 'conversation_id'
        )
        AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[1]
            AND NOT a.attisdropped AND a.attname = 'user_id'
        )
    ) INTO has_unique;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.conversation_members'::regclass
        AND c.contype = 'f'
        AND c.conname = 'conversation_members_conversation_id_fkey'
    ) INTO has_fk;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='conversation_members'
        AND column_name='role' AND udt_name='text'
    ) THEN
      invalid_check := invalid_check + (
        SELECT COUNT(*) FROM conversation_members
        WHERE role IS NOT NULL AND role NOT IN ('admin', 'member')
      );
    END IF;
  END IF;

  /* Indexes on message_conversations */
  IF mc_present THEN
    -- idx_conv_office (office_id) non-partial non-expression valid/ready
    SELECT true,
           x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
           (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
            FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
    INTO idx_office_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='message_conversations' AND i.relname='idx_conv_office'
    LIMIT 1;
    IF FOUND THEN
      idx_office_exists := true;
      idx_office_ok := (NOT idx_partial) AND (NOT idx_expr)
        AND idx_cols IS NOT DISTINCT FROM ARRAY['office_id']::text[]
        AND idx_valid IS TRUE AND idx_ready IS TRUE;
      IF NOT idx_office_ok THEN
        incompatible_index := COALESCE(incompatible_index, 'idx_conv_office');
      END IF;
    ELSE
      idx_office_exists := false;
      idx_office_ok := false;
    END IF;

    -- idx_convs_case_id (case_id) WHERE case_id IS NOT NULL
    idx_valid := NULL; idx_ready := NULL; idx_partial := NULL; idx_expr := NULL; idx_cols := NULL; idx_pred := NULL;
    SELECT true,
           x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
           (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
            FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
           pg_get_expr(x.indpred, x.indrelid)
    INTO idx_case_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols, idx_pred
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='message_conversations' AND i.relname='idx_convs_case_id'
    LIMIT 1;
    IF FOUND THEN
      idx_case_exists := true;
      idx_case_pred := idx_pred;
      idx_case_ok := idx_partial AND (NOT idx_expr)
        AND idx_cols IS NOT DISTINCT FROM ARRAY['case_id']::text[]
        AND COALESCE(idx_pred, '') ~* 'case_id[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
        AND idx_valid IS TRUE AND idx_ready IS TRUE;
      IF NOT idx_case_ok THEN
        incompatible_index := COALESCE(incompatible_index, 'idx_convs_case_id');
      END IF;
    ELSE
      idx_case_exists := false;
      idx_case_ok := false;
    END IF;

    -- idx_conv_updated (office_id, updated_at DESC)
    idx_valid := NULL; idx_ready := NULL; idx_partial := NULL; idx_expr := NULL; idx_cols := NULL; idx_opts := NULL;
    SELECT true,
           x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
           (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
            FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
           (SELECT array_agg(o::int ORDER BY ord.ordinality)
            FROM unnest(x.indoption) WITH ORDINALITY AS ord(o, ordinality))
    INTO idx_updated_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols, idx_opts
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='message_conversations' AND i.relname='idx_conv_updated'
    LIMIT 1;
    IF FOUND THEN
      idx_updated_exists := true;
      /* indoption bit 0 = DESC; second key must be DESC */
      idx_updated_ok := (NOT idx_partial) AND (NOT idx_expr)
        AND idx_cols IS NOT DISTINCT FROM ARRAY['office_id','updated_at']::text[]
        AND idx_opts IS NOT NULL
        AND array_length(idx_opts, 1) = 2
        AND (idx_opts[2] & 1) = 1
        AND idx_valid IS TRUE AND idx_ready IS TRUE;
      IF NOT idx_updated_ok THEN
        incompatible_index := COALESCE(incompatible_index, 'idx_conv_updated');
      END IF;
    ELSE
      idx_updated_exists := false;
      idx_updated_ok := false;
    END IF;
  END IF;

  /* Indexes on conversation_members */
  IF cm_present THEN
    idx_valid := NULL; idx_ready := NULL; idx_partial := NULL; idx_expr := NULL; idx_cols := NULL;
    SELECT true,
           x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
           (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
            FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
    INTO idx_mconv_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='conversation_members' AND i.relname='idx_conv_members_conv'
    LIMIT 1;
    IF FOUND THEN
      idx_mconv_exists := true;
      idx_mconv_ok := (NOT idx_partial) AND (NOT idx_expr)
        AND idx_cols IS NOT DISTINCT FROM ARRAY['conversation_id']::text[]
        AND idx_valid IS TRUE AND idx_ready IS TRUE;
      IF NOT idx_mconv_ok THEN
        incompatible_index := COALESCE(incompatible_index, 'idx_conv_members_conv');
      END IF;
    ELSE
      idx_mconv_exists := false;
      idx_mconv_ok := false;
    END IF;

    idx_valid := NULL; idx_ready := NULL; idx_partial := NULL; idx_expr := NULL; idx_cols := NULL;
    SELECT true,
           x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
           (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
            FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
    INTO idx_muser_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='conversation_members' AND i.relname='idx_conv_members_user'
    LIMIT 1;
    IF FOUND THEN
      idx_muser_exists := true;
      idx_muser_ok := (NOT idx_partial) AND (NOT idx_expr)
        AND idx_cols IS NOT DISTINCT FROM ARRAY['user_id','office_id']::text[]
        AND idx_valid IS TRUE AND idx_ready IS TRUE;
      IF NOT idx_muser_ok THEN
        incompatible_index := COALESCE(incompatible_index, 'idx_conv_members_user');
      END IF;
    ELSE
      idx_muser_exists := false;
      idx_muser_ok := false;
    END IF;
  END IF;

  /* ═══════════════════════════════════════════════════════════════════════
     2. BLOCKERS — evaluated before any SAFE_AUTO_REPAIR short-circuit
     ═══════════════════════════════════════════════════════════════════════ */
  IF incompatible_type IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
  ELSIF null_req > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'NULL_REQUIRED_IDENTIFIERS';
  ELSIF dup_cnt > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_MEMBERSHIP';
  ELSIF invalid_check > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INVALID_CHECK_VALUES';
  ELSIF incompatible_index IS NOT NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_INDEX';

  /* ═══════════════════════════════════════════════════════════════════════
     3. SAFE_AUTO_REPAIR — only after blockers cleared
     ═══════════════════════════════════════════════════════════════════════ */
  ELSIF NOT mc_present OR NOT cm_present THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'TABLE_MISSING';
    lock_risk := 'MEDIUM';
  ELSIF NOT case_id_present THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'CASE_ID_MISSING';
    lock_risk := 'LOW';
  ELSIF missing_col IS NOT NULL THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'MEDIUM';
  ELSIF nullable_needs_set THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'SET_NOT_NULL_PENDING';
    lock_risk := 'LOW';
  ELSIF NOT has_pk_mc OR NOT has_pk_cm OR NOT has_unique
        OR NOT has_type_check OR NOT has_role_check
        OR NOT idx_office_ok OR NOT idx_case_ok OR NOT idx_updated_ok
        OR NOT idx_mconv_ok OR NOT idx_muser_ok THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'MEDIUM';

  /* ═══════════════════════════════════════════════════════════════════════
     4. ALREADY_CORRECT — full contract including all five indexes + arbiter
     ═══════════════════════════════════════════════════════════════════════ */
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := CASE
      WHEN has_fk THEN 'CONV_SCHEMA_READY_FK_INSTALLED'
      WHEN orphan_cnt > 0 THEN 'CONV_SCHEMA_READY_FK_DEFERRED_ORPHANS'
      ELSE 'CONV_SCHEMA_READY_FK_PENDING'
    END;
    lock_risk := 'LOW';
  END IF;

  RAISE NOTICE '031_preflight: message_conversations_present=% conversation_members_present=%', mc_present, cm_present;
  RAISE NOTICE '031_preflight: case_id_present=% case_id_udt=% missing_col=% incompatible_type=%',
    case_id_present, case_id_udt, missing_col, incompatible_type;
  RAISE NOTICE '031_preflight: pk_mc=% pk_cm=% unique_arbiter=% type_check=% role_check=% fk=%',
    has_pk_mc, has_pk_cm, has_unique, has_type_check, has_role_check, has_fk;
  RAISE NOTICE '031_preflight: null_required_identifiers=% duplicate_membership_groups=% orphan_members=% invalid_check=%',
    null_req, dup_cnt, orphan_cnt, invalid_check;
  RAISE NOTICE '031_preflight: nullable_needs_set=% incompatible_index=%',
    nullable_needs_set, incompatible_index;
  RAISE NOTICE '031_preflight: indexes office=%/% case=%/%(pred=%) updated=%/% mconv=%/% muser=%/%',
    idx_office_exists, idx_office_ok,
    idx_case_exists, idx_case_ok, idx_case_pred,
    idx_updated_exists, idx_updated_ok,
    idx_mconv_exists, idx_mconv_ok,
    idx_muser_exists, idx_muser_ok;
  RAISE NOTICE '031_preflight: estimated_rows message_conversations=% conversation_members=%',
    estimated_mc, estimated_cm;
  RAISE NOTICE '031_preflight: lock_risk=% (CREATE TABLE/INDEX / ADD COLUMN / SET NOT NULL; ACCESS EXCLUSIVE on constraints)',
    lock_risk;
  RAISE NOTICE '031_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '031_preflight: BLOCK — do NOT apply 031 until resolved (no DROP / invent ownership)';
  ELSIF action = 'ALREADY_CORRECT' THEN
    RAISE NOTICE '031_preflight: ALREADY_CORRECT — apply 031 is idempotent no-op expected';
  ELSE
    RAISE NOTICE '031_preflight: SAFE_AUTO_REPAIR — 031 can create/repair missing tables/columns/indexes/NOT NULL';
  END IF;
END $$;
