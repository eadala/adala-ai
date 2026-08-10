-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 031 — READ-ONLY checks for conversation schema
--
-- Does not CREATE / ALTER / DROP durable objects.
-- Run before applying 031_message_conversations_schema_authority.sql.
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
  case_id_udt TEXT := NULL;
  null_req BIGINT := 0;
  dup_cnt BIGINT := 0;
  orphan_cnt BIGINT := 0;
  has_pk_mc BOOLEAN := false;
  has_pk_cm BOOLEAN := false;
  has_unique BOOLEAN := false;
  has_type_check BOOLEAN := false;
  has_role_check BOOLEAN := false;
  has_fk BOOLEAN := false;
  idx_case_ok BOOLEAN := false;
  idx_case_exists BOOLEAN := false;
  idx_case_partial BOOLEAN := false;
  idx_case_pred TEXT := NULL;
  estimated_mc BIGINT := 0;
  estimated_cm BIGINT := 0;
  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'MEDIUM';
BEGIN
  IF mc_present THEN
    SELECT c.udt_name INTO case_id_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='message_conversations' AND c.column_name='case_id';
    SELECT COUNT(*) INTO estimated_mc FROM message_conversations;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.message_conversations'::regclass AND c.contype = 'p'
    ) INTO has_pk_mc;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.message_conversations'::regclass
        AND c.contype = 'c' AND c.conname = 'message_conversations_type_check'
    ) INTO has_type_check;
    SELECT COUNT(*) INTO null_req FROM message_conversations
    WHERE office_id IS NULL OR created_by IS NULL OR type IS NULL OR id IS NULL;
  END IF;

  IF cm_present THEN
    SELECT COUNT(*) INTO estimated_cm FROM conversation_members;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.conversation_members'::regclass AND c.contype = 'p'
    ) INTO has_pk_cm;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.conversation_members'::regclass
        AND c.contype = 'c' AND c.conname = 'conversation_members_role_check'
    ) INTO has_role_check;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.conversation_members'::regclass
        AND c.contype IN ('u', 'p')
        AND pg_get_constraintdef(c.oid) ILIKE '%(conversation_id, user_id)%'
    ) OR EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid = 'public.conversation_members'::regclass
        AND x.indisunique AND x.indisvalid
        AND x.indpred IS NULL AND x.indexprs IS NULL AND x.indnkeyatts = 2
    ) INTO has_unique;
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.conversation_members'::regclass
        AND c.contype = 'f'
        AND c.conname = 'conversation_members_conversation_id_fkey'
    ) INTO has_fk;
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT conversation_id, user_id FROM conversation_members
      GROUP BY conversation_id, user_id HAVING COUNT(*) > 1
    ) d;
    IF mc_present THEN
      SELECT COUNT(*) INTO orphan_cnt
      FROM conversation_members cm
      WHERE cm.conversation_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM message_conversations mc WHERE mc.id = cm.conversation_id);
    END IF;
    null_req := null_req + (
      SELECT COUNT(*) FROM conversation_members
      WHERE conversation_id IS NULL OR office_id IS NULL OR user_id IS NULL OR id IS NULL
    );
  END IF;

  IF mc_present THEN
    SELECT true, x.indpred IS NOT NULL, pg_get_expr(x.indpred, x.indrelid)
    INTO idx_case_exists, idx_case_partial, idx_case_pred
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='message_conversations' AND i.relname='idx_convs_case_id'
    LIMIT 1;
    IF FOUND THEN
      idx_case_ok := idx_case_partial
        AND COALESCE(idx_case_pred, '') ~* 'case_id[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL';
    ELSE
      idx_case_exists := false;
      idx_case_ok := false;
    END IF;
  END IF;

  IF NOT mc_present OR NOT cm_present THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'TABLE_MISSING';
    lock_risk := 'MEDIUM';
  ELSIF case_id_udt IS NULL THEN
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'CASE_ID_MISSING';
    lock_risk := 'LOW';
  ELSIF case_id_udt IS DISTINCT FROM 'text' THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_TYPE';
  ELSIF null_req > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'NULL_REQUIRED_IDENTIFIERS';
  ELSIF dup_cnt > 0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'DUPLICATE_MEMBERSHIP';
  ELSIF idx_case_exists AND NOT idx_case_ok THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INCOMPATIBLE_INDEX';
  ELSIF has_pk_mc AND has_pk_cm AND has_unique AND has_type_check AND has_role_check
        AND case_id_udt = 'text' AND idx_case_ok THEN
    action := 'ALREADY_CORRECT';
    reason_code := CASE
      WHEN has_fk THEN 'CONV_SCHEMA_READY_FK_INSTALLED'
      WHEN orphan_cnt > 0 THEN 'CONV_SCHEMA_READY_FK_DEFERRED_ORPHANS'
      ELSE 'CONV_SCHEMA_READY_FK_PENDING'
    END;
    lock_risk := 'LOW';
  ELSE
    action := 'SAFE_AUTO_REPAIR';
    reason_code := 'PARTIAL_SCHEMA';
    lock_risk := 'MEDIUM';
  END IF;

  RAISE NOTICE '031_preflight: message_conversations_present=% conversation_members_present=%', mc_present, cm_present;
  RAISE NOTICE '031_preflight: case_id_udt=% pk_mc=% pk_cm=% unique_arbiter=% type_check=% role_check=% fk=%',
    case_id_udt, has_pk_mc, has_pk_cm, has_unique, has_type_check, has_role_check, has_fk;
  RAISE NOTICE '031_preflight: null_required_identifiers=% duplicate_membership_groups=% orphan_members=%',
    null_req, dup_cnt, orphan_cnt;
  RAISE NOTICE '031_preflight: idx_convs_case_id exists=% partial_ok=% pred=%',
    idx_case_exists, idx_case_ok, idx_case_pred;
  RAISE NOTICE '031_preflight: estimated_rows message_conversations=% conversation_members=%',
    estimated_mc, estimated_cm;
  RAISE NOTICE '031_preflight: lock_risk=% (CREATE TABLE/INDEX / ADD COLUMN; ACCESS EXCLUSIVE on constraints)',
    lock_risk;
  RAISE NOTICE '031_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE NOTICE '031_preflight: BLOCK — do NOT apply 031 until resolved (no DROP / invent ownership)';
  ELSIF action = 'ALREADY_CORRECT' THEN
    RAISE NOTICE '031_preflight: ALREADY_CORRECT — apply 031 is idempotent no-op expected';
  ELSE
    RAISE NOTICE '031_preflight: SAFE_AUTO_REPAIR — 031 can create/repair missing tables/columns/indexes';
  END IF;
END $$;
