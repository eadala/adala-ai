-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 052: Messaging Runtime indexes schema authority (Stage 8)
--
-- Owns former Runtime CREATE INDEX IIFE from internal-messages.ts:
--   A) idx_msgs_sender_date   ON office_messages (sender_id, created_at DESC)
--   B) idx_msgs_office_date   ON office_messages (office_id, created_at DESC)
--   C) idx_msgs_office_folder ON office_messages (office_id, folder)   ← not in 020
--   D) idx_rcpt_user_unread    ON office_message_recipients (user_id, is_read)
--                               WHERE is_read = FALSE
--   E) idx_rcpt_msg            ON office_message_recipients (message_id)
--   F) idx_attach_msg          ON office_message_attachments (message_id)
--
-- Contract = proven Runtime CREATE INDEX + live query predicates
-- (folder/office/sender ORDER BY created_at DESC; recipient unread; joins).
--
-- Relationship to Migration 020:
--   020 already creates A/B/D/E/F when tables exist (no fail-closed shape).
--   052 re-asserts exact shapes fail-closed and adds C (folder index gap).
--   020 is not rewritten. idx_conv_updated remains owned by 031.
--
-- Base tables: office_messages via 016; recipients/attachments may be absent
-- in greenfield — skip CREATE with NOTICE when table missing (no invented
-- CREATE TABLE). Stolen/wrong-shape index names → BLOCK (no DROP INDEX).
-- Idempotent. Fail-closed. No DROP/TRUNCATE/DELETE.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  spec RECORD;
  expected_table_oid OID;
  actual_table_oid OID;
  index_unique BOOLEAN;
  index_partial BOOLEAN;
  index_expression BOOLEAN;
  index_valid BOOLEAN;
  index_ready BOOLEAN;
  index_columns TEXT[];
  index_options INT[];
  index_pred TEXT;
  desc_ok BOOLEAN;
  opt_i INT;
  col_missing BOOLEAN;
  c TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      (
        'idx_msgs_sender_date',
        'office_messages',
        ARRAY['sender_id','created_at']::text[],
        ARRAY['sender_id','created_at']::text[],
        FALSE,
        TRUE,
        NULL::text,
        $c$CREATE INDEX IF NOT EXISTS idx_msgs_sender_date ON office_messages (sender_id, created_at DESC)$c$
      ),
      (
        'idx_msgs_office_date',
        'office_messages',
        ARRAY['office_id','created_at']::text[],
        ARRAY['office_id','created_at']::text[],
        FALSE,
        TRUE,
        NULL::text,
        $c$CREATE INDEX IF NOT EXISTS idx_msgs_office_date ON office_messages (office_id, created_at DESC)$c$
      ),
      (
        'idx_msgs_office_folder',
        'office_messages',
        ARRAY['office_id','folder']::text[],
        ARRAY['office_id','folder']::text[],
        FALSE,
        FALSE,
        NULL::text,
        $c$CREATE INDEX IF NOT EXISTS idx_msgs_office_folder ON office_messages (office_id, folder)$c$
      ),
      (
        'idx_rcpt_user_unread',
        'office_message_recipients',
        ARRAY['user_id','is_read']::text[],
        ARRAY['user_id','is_read']::text[],
        TRUE,
        FALSE,
        'is_read[[:space:]]*=[[:space:]]*false',
        $c$CREATE INDEX IF NOT EXISTS idx_rcpt_user_unread ON office_message_recipients (user_id, is_read) WHERE is_read = FALSE$c$
      ),
      (
        'idx_rcpt_msg',
        'office_message_recipients',
        ARRAY['message_id']::text[],
        ARRAY['message_id']::text[],
        FALSE,
        FALSE,
        NULL::text,
        $c$CREATE INDEX IF NOT EXISTS idx_rcpt_msg ON office_message_recipients (message_id)$c$
      ),
      (
        'idx_attach_msg',
        'office_message_attachments',
        ARRAY['message_id']::text[],
        ARRAY['message_id']::text[],
        FALSE,
        FALSE,
        NULL::text,
        $c$CREATE INDEX IF NOT EXISTS idx_attach_msg ON office_message_attachments (message_id)$c$
      )
    ) AS t(
      index_name, table_name, required_cols, expected_cols,
      expect_partial, expect_last_desc, pred_regex, create_sql
    )
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));

    SELECT x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality)),
      pg_get_expr(x.indpred, x.indrelid)
    INTO actual_table_oid, index_unique, index_partial, index_expression,
      index_valid, index_ready, index_columns, index_options, index_pred
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=spec.index_name;

    IF FOUND THEN
      desc_ok := true;
      IF index_options IS NULL
         OR cardinality(index_options) IS DISTINCT FROM cardinality(spec.expected_cols) THEN
        desc_ok := false;
      ELSE
        FOR opt_i IN 1 .. cardinality(spec.expected_cols) LOOP
          IF opt_i = cardinality(spec.expected_cols) AND spec.expect_last_desc THEN
            IF (index_options[opt_i] & 1) IS DISTINCT FROM 1 THEN desc_ok := false; END IF;
          ELSE
            IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
          END IF;
        END LOOP;
      END IF;

      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS DISTINCT FROM FALSE
         OR index_partial IS DISTINCT FROM spec.expect_partial
         OR index_expression IS DISTINCT FROM FALSE
         OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE
         OR index_columns IS DISTINCT FROM spec.expected_cols
         OR desc_ok IS NOT TRUE
         OR (
           spec.expect_partial
           AND COALESCE(index_pred, '') !~* spec.pred_regex
         ) THEN
        RAISE EXCEPTION
          '052_messaging_indexes: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (cols=% opts=% partial=% pred=%). No DROP INDEX.',
          spec.index_name, index_columns, index_options, index_partial, coalesce(index_pred,'<none>');
      END IF;
    ELSE
      IF expected_table_oid IS NULL THEN
        RAISE NOTICE
          '052_messaging_indexes: skipping % — table % missing (no invented CREATE TABLE)',
          spec.index_name, spec.table_name;
        CONTINUE;
      END IF;

      col_missing := false;
      FOREACH c IN ARRAY spec.required_cols LOOP
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name=spec.table_name AND column_name=c
        ) THEN
          col_missing := true;
          RAISE NOTICE
            '052_messaging_indexes: skipping % — %.% missing',
            spec.index_name, spec.table_name, c;
        END IF;
      END LOOP;
      IF col_missing THEN
        CONTINUE;
      END IF;

      EXECUTE spec.create_sql;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  ok BOOLEAN;
BEGIN
  IF to_regclass('public.office_messages') IS NULL THEN
    RAISE EXCEPTION
      '052_messaging_indexes: POST_APPLY_READINESS_FAILED — office_messages missing (required by 016 before 052)';
  END IF;

  -- Required office_messages indexes (always)
  SELECT EXISTS (
    SELECT 1 FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname='idx_msgs_sender_date'
      AND x.indrelid='public.office_messages'::regclass
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisunique IS DISTINCT FROM TRUE
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['sender_id','created_at']::text[]
      AND ((SELECT (array_agg(o::int ORDER BY k.ordinality))[2]
            FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality)) & 1) = 1
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION '052_messaging_indexes: POST_APPLY_READINESS_FAILED — idx_msgs_sender_date missing/wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname='idx_msgs_office_date'
      AND x.indrelid='public.office_messages'::regclass
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisunique IS DISTINCT FROM TRUE
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id','created_at']::text[]
      AND ((SELECT (array_agg(o::int ORDER BY k.ordinality))[2]
            FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality)) & 1) = 1
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION '052_messaging_indexes: POST_APPLY_READINESS_FAILED — idx_msgs_office_date missing/wrong shape';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname='idx_msgs_office_folder'
      AND x.indrelid='public.office_messages'::regclass
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisunique IS DISTINCT FROM TRUE
      AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
           FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
          = ARRAY['office_id','folder']::text[]
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION '052_messaging_indexes: POST_APPLY_READINESS_FAILED — idx_msgs_office_folder missing/wrong shape';
  END IF;

  -- Recipients / attachments indexes only when tables exist
  IF to_regclass('public.office_message_recipients') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_class i
      JOIN pg_namespace n ON n.oid=i.relnamespace
      JOIN pg_index x ON x.indexrelid=i.oid
      WHERE n.nspname='public' AND i.relname='idx_rcpt_user_unread'
        AND x.indrelid='public.office_message_recipients'::regclass
        AND x.indisvalid AND x.indisready AND x.indpred IS NOT NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['user_id','is_read']::text[]
        AND pg_get_expr(x.indpred, x.indrelid) ~* 'is_read[[:space:]]*=[[:space:]]*false'
    ) INTO ok;
    IF NOT ok THEN
      RAISE EXCEPTION '052_messaging_indexes: POST_APPLY_READINESS_FAILED — idx_rcpt_user_unread missing/wrong shape';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM pg_class i
      JOIN pg_namespace n ON n.oid=i.relnamespace
      JOIN pg_index x ON x.indexrelid=i.oid
      WHERE n.nspname='public' AND i.relname='idx_rcpt_msg'
        AND x.indrelid='public.office_message_recipients'::regclass
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['message_id']::text[]
    ) INTO ok;
    IF NOT ok THEN
      RAISE EXCEPTION '052_messaging_indexes: POST_APPLY_READINESS_FAILED — idx_rcpt_msg missing/wrong shape';
    END IF;
  END IF;

  IF to_regclass('public.office_message_attachments') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_class i
      JOIN pg_namespace n ON n.oid=i.relnamespace
      JOIN pg_index x ON x.indexrelid=i.oid
      WHERE n.nspname='public' AND i.relname='idx_attach_msg'
        AND x.indrelid='public.office_message_attachments'::regclass
        AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisunique IS DISTINCT FROM TRUE
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped)
            = ARRAY['message_id']::text[]
    ) INTO ok;
    IF NOT ok THEN
      RAISE EXCEPTION '052_messaging_indexes: POST_APPLY_READINESS_FAILED — idx_attach_msg missing/wrong shape';
    END IF;
  END IF;

  RAISE NOTICE
    '052_messaging_indexes: post-apply FULL READY (reason=MESSAGING_RUNTIME_INDEXES_READY; idx_msgs_sender_date; idx_msgs_office_date; idx_msgs_office_folder; conditional rcpt/attach)';
END $$;

COMMIT;
