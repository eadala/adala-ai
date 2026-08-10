-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 031: message_conversations + conversation_members schema authority
-- (Stage 23.3B)
--
-- Owns CREATE / column repair / CHECK / UNIQUE / indexes for:
--   message_conversations
--   conversation_members
--
-- Former Runtime DDL:
--   ensureConversationTables() — modules/operations/internal-messages.ts
--   idx_conv_updated — internal-messages extras IIFE
--   idx_convs_case_id — modules/legal-core/cases.ts (non-partial; conflicting)
--
-- Relationship to Migration 020:
--   020 already creates idx_conv_office / idx_convs_case_id (partial) /
--   idx_conv_members_conv / idx_conv_members_user when tables exist.
--   031 is complete table authority and re-asserts those index definitions
--   (plus idx_conv_updated). 020 is not rewritten.
--
-- App contract (conversations.ts + cases linked-comms):
--   message_conversations.case_id TEXT nullable (required; Runtime CREATE omitted it)
--   UNIQUE (conversation_id, user_id) for ON CONFLICT
--   No validating FK from case_id → cases
--
-- Apply AFTER: … → 030
-- Idempotent / legacy-safe:
--   CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
--   BLOCK (RAISE) on incompatible types, dup membership keys, NULL required
--     identifiers, incompatible same-name indexes (no DROP INDEX)
--   conversation_members → message_conversations FK: legacy-safe skip on orphans
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- Do NOT deploy/apply from the PR agent — ops apply out-of-band after preflight.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Fresh CREATE (includes case_id TEXT — required by app) ─────────────────
CREATE TABLE IF NOT EXISTS message_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   TEXT NOT NULL,
  title       TEXT,
  type        TEXT NOT NULL DEFAULT 'direct',
  created_by  TEXT NOT NULL,
  case_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_conversations_type_check
    CHECK (type IN ('direct', 'group'))
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL,
  office_id         TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  user_name         TEXT,
  role              TEXT NOT NULL DEFAULT 'member',
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_members_role_check
    CHECK (role IN ('admin', 'member')),
  CONSTRAINT conversation_members_conversation_id_user_id_key
    UNIQUE (conversation_id, user_id)
);

-- ── Column repair (legacy Runtime CREATE omitted case_id) ──────────────────
ALTER TABLE message_conversations ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE message_conversations ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE message_conversations ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE message_conversations ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE message_conversations ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE message_conversations ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE message_conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE message_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ;

ALTER TABLE message_conversations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE message_conversations ALTER COLUMN type SET DEFAULT 'direct';
ALTER TABLE message_conversations ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE message_conversations ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE conversation_members ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE conversation_members ALTER COLUMN role SET DEFAULT 'member';
ALTER TABLE conversation_members ALTER COLUMN joined_at SET DEFAULT NOW();

-- ── Guards, CHECKs, PK/UNIQUE, indexes, legacy-safe FK ─────────────────────
DO $$
DECLARE
  udt TEXT;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  orphan_cnt BIGINT;
  has_pk BOOLEAN;
  has_unique BOOLEAN;
  has_check BOOLEAN;
  idx_am TEXT;
  idx_cols TEXT[];
  idx_partial BOOLEAN;
  idx_pred TEXT;
  idx_valid BOOLEAN;
  idx_ready BOOLEAN;
  idx_exists BOOLEAN;
  idx_expr BOOLEAN;
  idx_opts INT[];
  fk_installed BOOLEAN := false;
  fk_deferred_reason TEXT := NULL;
  not_null_ok BOOLEAN;
BEGIN
  /* ── Type checks (BLOCK incompatible existing types) ── */
  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='id';
  IF udt IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — message_conversations.id udt=%; expected uuid', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='office_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — message_conversations.office_id udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='title';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — message_conversations.title udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='type';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — message_conversations.type udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='created_by';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — message_conversations.created_by udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='created_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — message_conversations.created_at udt=%; expected timestamptz', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='updated_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — message_conversations.updated_at udt=%; expected timestamptz', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='case_id';
  IF udt IS NULL THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=CASE_ID_MISSING) — case_id still absent after ADD COLUMN';
  END IF;
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — message_conversations.case_id udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='id';
  IF udt IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — conversation_members.id udt=%; expected uuid', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='conversation_id';
  IF udt IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — conversation_members.conversation_id udt=%; expected uuid', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='office_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — conversation_members.office_id udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='user_id';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — conversation_members.user_id udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='user_name';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — conversation_members.user_name udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='role';
  IF udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — conversation_members.role udt=%; expected text', udt;
  END IF;

  SELECT c.udt_name INTO udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='conversation_members' AND c.column_name='joined_at';
  IF udt IS DISTINCT FROM 'timestamptz' THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — conversation_members.joined_at udt=%; expected timestamptz', udt;
  END IF;

  /* ── NULL required identifiers (BLOCK before SET NOT NULL) ── */
  SELECT COUNT(*) INTO null_cnt FROM message_conversations
  WHERE id IS NULL OR office_id IS NULL OR created_by IS NULL OR type IS NULL
     OR created_at IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED_IDENTIFIERS) — % message_conversations row(s) with NULL required columns', null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM conversation_members
  WHERE id IS NULL OR conversation_id IS NULL OR office_id IS NULL OR user_id IS NULL
     OR role IS NULL OR joined_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED_IDENTIFIERS) — % conversation_members row(s) with NULL required columns', null_cnt;
  END IF;

  /* ── SET NOT NULL to match greenfield contract (safe: nulls already blocked) ── */
  ALTER TABLE message_conversations ALTER COLUMN id SET NOT NULL;
  ALTER TABLE message_conversations ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE message_conversations ALTER COLUMN type SET NOT NULL;
  ALTER TABLE message_conversations ALTER COLUMN created_by SET NOT NULL;
  ALTER TABLE message_conversations ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE message_conversations ALTER COLUMN updated_at SET NOT NULL;

  ALTER TABLE conversation_members ALTER COLUMN id SET NOT NULL;
  ALTER TABLE conversation_members ALTER COLUMN conversation_id SET NOT NULL;
  ALTER TABLE conversation_members ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE conversation_members ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE conversation_members ALTER COLUMN role SET NOT NULL;
  ALTER TABLE conversation_members ALTER COLUMN joined_at SET NOT NULL;

  /* ── Duplicate membership pairs ── */
  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT conversation_id, user_id
    FROM conversation_members
    GROUP BY conversation_id, user_id
    HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_MEMBERSHIP) — % duplicate (conversation_id,user_id) group(s); clean before UNIQUE', dup_cnt;
  END IF;

  /* ── Invalid CHECK values ── */
  SELECT COUNT(*) INTO null_cnt FROM message_conversations WHERE type NOT IN ('direct', 'group');
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INVALID_CHECK_VALUES) — % message_conversations row(s) with type not in (direct,group)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM conversation_members WHERE role NOT IN ('admin', 'member');
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INVALID_CHECK_VALUES) — % conversation_members row(s) with role not in (admin,member)', null_cnt;
  END IF;

  /* ── PKs ── */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.message_conversations'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM message_conversations WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED_IDENTIFIERS) — NULL id blocks PK on message_conversations';
    END IF;
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT id FROM message_conversations GROUP BY id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_PK) — duplicate id on message_conversations';
    END IF;
    ALTER TABLE message_conversations ADD CONSTRAINT message_conversations_pkey PRIMARY KEY (id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.conversation_members'::regclass AND c.contype = 'p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO null_cnt FROM conversation_members WHERE id IS NULL;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED_IDENTIFIERS) — NULL id blocks PK on conversation_members';
    END IF;
    ALTER TABLE conversation_members ADD CONSTRAINT conversation_members_pkey PRIMARY KEY (id);
  END IF;

  /* ── CHECK constraints ── */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.message_conversations'::regclass
      AND c.contype = 'c'
      AND c.conname = 'message_conversations_type_check'
  ) INTO has_check;
  IF NOT has_check THEN
    ALTER TABLE message_conversations
      ADD CONSTRAINT message_conversations_type_check CHECK (type IN ('direct', 'group'));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.conversation_members'::regclass
      AND c.contype = 'c'
      AND c.conname = 'conversation_members_role_check'
  ) INTO has_check;
  IF NOT has_check THEN
    ALTER TABLE conversation_members
      ADD CONSTRAINT conversation_members_role_check CHECK (role IN ('admin', 'member'));
  END IF;

  /* ── UNIQUE (conversation_id, user_id) arbiter for ON CONFLICT ── */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.conversation_members'::regclass
      AND c.contype IN ('u', 'p')
      AND pg_get_constraintdef(c.oid) ILIKE '%(conversation_id, user_id)%'
  ) INTO has_unique;
  IF NOT has_unique THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_index x
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
  END IF;
  IF NOT has_unique THEN
    ALTER TABLE conversation_members
      ADD CONSTRAINT conversation_members_conversation_id_user_id_key
      UNIQUE (conversation_id, user_id);
  END IF;

  /* ── Index helper: BLOCK incompatible same-name; create if absent ── */
  -- idx_conv_office: (office_id) non-partial
  SELECT true, am.amname, x.indisvalid, x.indisready, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
         pg_get_expr(x.indpred, x.indrelid)
  INTO idx_exists, idx_am, idx_valid, idx_ready, idx_partial, idx_cols, idx_pred
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_am am ON am.oid = i.relam
  WHERE n.nspname = 'public' AND t.relname = 'message_conversations' AND i.relname = 'idx_conv_office'
  LIMIT 1;
  IF NOT FOUND THEN
    idx_exists := false;
  END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_cols IS DISTINCT FROM ARRAY['office_id']::text[] OR idx_valid IS NOT TRUE THEN
      RAISE EXCEPTION
        '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_conv_office exists with incompatible shape (cols=% partial=% valid=%). No DROP INDEX.',
        idx_cols, idx_partial, idx_valid;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_conv_office ON message_conversations (office_id);
  END IF;

  -- idx_convs_case_id: (case_id) WHERE case_id IS NOT NULL  (020 definition)
  idx_exists := false;
  SELECT true, am.amname, x.indisvalid, x.indisready, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
         pg_get_expr(x.indpred, x.indrelid)
  INTO idx_exists, idx_am, idx_valid, idx_ready, idx_partial, idx_cols, idx_pred
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_am am ON am.oid = i.relam
  WHERE n.nspname = 'public' AND t.relname = 'message_conversations' AND i.relname = 'idx_convs_case_id'
  LIMIT 1;
  IF NOT FOUND THEN
    idx_exists := false;
  END IF;
  IF idx_exists THEN
    IF NOT idx_partial
       OR idx_cols IS DISTINCT FROM ARRAY['case_id']::text[]
       OR COALESCE(idx_pred, '') !~* 'case_id[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
       OR idx_valid IS NOT TRUE THEN
      RAISE EXCEPTION
        '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_convs_case_id exists with incompatible shape (cols=% partial=% pred=%). Expected partial (case_id) WHERE case_id IS NOT NULL. No DROP INDEX.',
        idx_cols, idx_partial, idx_pred;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_convs_case_id
      ON message_conversations (case_id)
      WHERE case_id IS NOT NULL;
  END IF;

  -- idx_conv_updated: (office_id, updated_at DESC) non-partial
  idx_exists := false;
  SELECT true, x.indisvalid, x.indisready, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
         (SELECT array_agg(o::int ORDER BY ord.ordinality)
          FROM unnest(x.indoption) WITH ORDINALITY AS ord(o, ordinality))
  INTO idx_exists, idx_valid, idx_ready, idx_partial, idx_expr, idx_cols, idx_opts
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'message_conversations' AND i.relname = 'idx_conv_updated'
  LIMIT 1;
  IF NOT FOUND THEN
    idx_exists := false;
  END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_expr
       OR idx_cols IS DISTINCT FROM ARRAY['office_id','updated_at']::text[]
       OR idx_opts IS NULL
       OR array_length(idx_opts, 1) IS DISTINCT FROM 2
       OR (idx_opts[2] & 1) IS DISTINCT FROM 1
       OR idx_valid IS NOT TRUE OR idx_ready IS NOT TRUE THEN
      RAISE EXCEPTION
        '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_conv_updated incompatible (cols=% opts=% partial=%). Expected (office_id, updated_at DESC). No DROP INDEX.',
        idx_cols, idx_opts, idx_partial;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_conv_updated
      ON message_conversations (office_id, updated_at DESC);
  END IF;

  -- idx_conv_members_conv: (conversation_id)
  idx_exists := false;
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'conversation_members' AND i.relname = 'idx_conv_members_conv'
  LIMIT 1;
  IF NOT FOUND THEN
    idx_exists := false;
  END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_cols IS DISTINCT FROM ARRAY['conversation_id']::text[] OR idx_valid IS NOT TRUE THEN
      RAISE EXCEPTION
        '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_conv_members_conv incompatible (cols=%). No DROP INDEX.',
        idx_cols;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members (conversation_id);
  END IF;

  -- idx_conv_members_user: (user_id, office_id)
  idx_exists := false;
  SELECT true, x.indisvalid, x.indpred IS NOT NULL,
         (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
          FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
  INTO idx_exists, idx_valid, idx_partial, idx_cols
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'public' AND t.relname = 'conversation_members' AND i.relname = 'idx_conv_members_user'
  LIMIT 1;
  IF NOT FOUND THEN
    idx_exists := false;
  END IF;
  IF idx_exists THEN
    IF idx_partial OR idx_cols IS DISTINCT FROM ARRAY['user_id','office_id']::text[] OR idx_valid IS NOT TRUE THEN
      RAISE EXCEPTION
        '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_conv_members_user incompatible (cols=%). No DROP INDEX.',
        idx_cols;
    END IF;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members (user_id, office_id);
  END IF;

  /* ── Legacy-safe FK conversation_members.conversation_id → message_conversations(id) ── */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.conversation_members'::regclass
      AND c.contype = 'f'
      AND c.conname = 'conversation_members_conversation_id_fkey'
  ) INTO fk_installed;

  IF NOT fk_installed THEN
    SELECT COUNT(*) INTO orphan_cnt
    FROM conversation_members cm
    WHERE cm.conversation_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM message_conversations mc WHERE mc.id = cm.conversation_id
      );
    IF orphan_cnt > 0 THEN
      fk_deferred_reason := format('orphan_members=%s', orphan_cnt);
      RAISE WARNING
        '031_conv: FK_DEFERRED_ORPHANS — skipping conversation_members_conversation_id_fkey; % orphan member row(s); no invent/delete/remap. Schema otherwise proceeds; FK not fully installed.',
        orphan_cnt;
    ELSE
      BEGIN
        ALTER TABLE conversation_members
          ADD CONSTRAINT conversation_members_conversation_id_fkey
          FOREIGN KEY (conversation_id)
          REFERENCES message_conversations(id)
          ON DELETE CASCADE;
        fk_installed := true;
      EXCEPTION
        WHEN duplicate_object THEN
          fk_installed := true;
        WHEN foreign_key_violation THEN
          fk_deferred_reason := 'foreign_key_violation';
          RAISE WARNING '031_conv: FK_DEFERRED_ORPHANS — foreign_key_violation; FK not installed';
        WHEN datatype_mismatch THEN
          RAISE EXCEPTION '031_conv: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — FK datatype_mismatch';
      END;
    END IF;
  END IF;

  IF fk_installed THEN
    RAISE NOTICE '031_conv: conversation_members_conversation_id_fkey INSTALLED (ON DELETE CASCADE)';
  ELSE
    RAISE NOTICE '031_conv: conversation_members_conversation_id_fkey DEFERRED (%); not claiming full FK readiness',
      COALESCE(fk_deferred_reason, 'unknown');
  END IF;

  /* ── Post-apply readiness gate (fail closed; no false full-ready) ── */
  IF to_regclass('public.message_conversations') IS NULL
     OR to_regclass('public.conversation_members') IS NULL THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — required table missing';
  END IF;

  /* Required column types */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_conversations'
      AND column_name='id' AND udt_name='uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_conversations'
      AND column_name='office_id' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_conversations'
      AND column_name='title' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_conversations'
      AND column_name='type' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_conversations'
      AND column_name='created_by' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_conversations'
      AND column_name='created_at' AND udt_name='timestamptz'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_conversations'
      AND column_name='updated_at' AND udt_name='timestamptz'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='message_conversations'
      AND column_name='case_id' AND udt_name='text'
  ) THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — message_conversations required column types missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_members'
      AND column_name='id' AND udt_name='uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_members'
      AND column_name='conversation_id' AND udt_name='uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_members'
      AND column_name='office_id' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_members'
      AND column_name='user_id' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_members'
      AND column_name='user_name' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_members'
      AND column_name='role' AND udt_name='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_members'
      AND column_name='joined_at' AND udt_name='timestamptz'
  ) THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — conversation_members required column types missing';
  END IF;

  /* NOT NULL contract (greenfield-equivalent) */
  SELECT bool_and(a.attnotnull) INTO not_null_ok
  FROM pg_attribute a
  JOIN pg_class t ON t.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'message_conversations'
    AND a.attname IN ('id', 'office_id', 'type', 'created_by', 'created_at', 'updated_at')
    AND NOT a.attisdropped AND a.attnum > 0;
  IF not_null_ok IS NOT TRUE THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — message_conversations required NOT NULL missing';
  END IF;

  SELECT bool_and(a.attnotnull) INTO not_null_ok
  FROM pg_attribute a
  JOIN pg_class t ON t.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'conversation_members'
    AND a.attname IN ('id', 'conversation_id', 'office_id', 'user_id', 'role', 'joined_at')
    AND NOT a.attisdropped AND a.attnum > 0;
  IF not_null_ok IS NOT TRUE THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — conversation_members required NOT NULL missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.message_conversations'::regclass AND c.contype = 'p'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.conversation_members'::regclass AND c.contype = 'p'
  ) THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — required PK missing';
  END IF;

  /* Strict UNIQUE (conversation_id, user_id) arbiter for ON CONFLICT */
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
  IF NOT has_unique THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — UNIQUE(conversation_id,user_id) ON CONFLICT arbiter missing';
  END IF;

  /* Five indexes — expected shapes */
  IF NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='message_conversations' AND i.relname='idx_conv_office'
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
         = ARRAY['office_id']::text[]
  ) THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — idx_conv_office missing/invalid shape';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='message_conversations' AND i.relname='idx_convs_case_id'
      AND x.indisvalid AND x.indisready AND x.indpred IS NOT NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
         = ARRAY['case_id']::text[]
      AND pg_get_expr(x.indpred, x.indrelid) ~* 'case_id[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
  ) THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — idx_convs_case_id missing or not partial WHERE case_id IS NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='message_conversations' AND i.relname='idx_conv_updated'
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
         = ARRAY['office_id','updated_at']::text[]
      AND ((SELECT (array_agg(o::int ORDER BY ord.ordinality))[2]
            FROM unnest(x.indoption) WITH ORDINALITY AS ord(o, ordinality)) & 1) = 1
  ) THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — idx_conv_updated missing or not (office_id, updated_at DESC)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='conversation_members' AND i.relname='idx_conv_members_conv'
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
         = ARRAY['conversation_id']::text[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='conversation_members' AND i.relname='idx_conv_members_user'
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped)
         = ARRAY['user_id','office_id']::text[]
  ) THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — conversation_members indexes missing/invalid shape';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.message_conversations'::regclass
      AND c.contype = 'c' AND c.conname = 'message_conversations_type_check'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.conversation_members'::regclass
      AND c.contype = 'c' AND c.conname = 'conversation_members_role_check'
  ) THEN
    RAISE EXCEPTION '031_conv: POST_APPLY_READINESS_FAILED — CHECK contracts missing';
  END IF;

  /* Re-read FK status for explicit reporting (installed vs deferred — never claim full FK if skipped) */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.conversation_members'::regclass
      AND c.contype = 'f'
      AND c.conname = 'conversation_members_conversation_id_fkey'
  ) INTO fk_installed;

  IF fk_installed THEN
    RAISE NOTICE '031_conv: post-apply readiness gate passed (tables/cols/NOT NULL/PK/UNIQUE/CHECK/indexes); fk_status=INSTALLED';
  ELSIF orphan_cnt > 0 OR fk_deferred_reason IS NOT NULL THEN
    RAISE NOTICE '031_conv: post-apply readiness gate passed (tables/cols/NOT NULL/PK/UNIQUE/CHECK/indexes); fk_status=DEFERRED (%)',
      COALESCE(fk_deferred_reason, format('orphan_members=%s', orphan_cnt));
  ELSE
    RAISE NOTICE '031_conv: post-apply readiness gate passed (tables/cols/NOT NULL/PK/UNIQUE/CHECK/indexes); fk_status=PENDING';
  END IF;
END $$;

COMMIT;
