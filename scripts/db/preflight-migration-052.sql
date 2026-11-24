-- ═══════════════════════════════════════════════════════════════════════════
-- Preflight Migration 052 — READ-ONLY checks for Messaging Runtime indexes
-- Owns: idx_msgs_sender_date / idx_msgs_office_date / idx_msgs_office_folder
--       idx_rcpt_user_unread / idx_rcpt_msg / idx_attach_msg
-- Does not CREATE / ALTER / DROP durable objects.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '▶ 052 preflight: index + base-table presence'
SELECT
  to_regclass('public.office_messages') IS NOT NULL AS office_messages_present,
  to_regclass('public.office_message_recipients') IS NOT NULL AS recipients_present,
  to_regclass('public.office_message_attachments') IS NOT NULL AS attachments_present,
  to_regclass('public.idx_msgs_sender_date') IS NOT NULL AS idx_msgs_sender_date_present,
  to_regclass('public.idx_msgs_office_date') IS NOT NULL AS idx_msgs_office_date_present,
  to_regclass('public.idx_msgs_office_folder') IS NOT NULL AS idx_msgs_office_folder_present,
  to_regclass('public.idx_rcpt_user_unread') IS NOT NULL AS idx_rcpt_user_unread_present,
  to_regclass('public.idx_rcpt_msg') IS NOT NULL AS idx_rcpt_msg_present,
  to_regclass('public.idx_attach_msg') IS NOT NULL AS idx_attach_msg_present;

\echo '▶ 052 preflight: full contract and decision'
DO $preflight$
DECLARE
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  incompatible_indexes TEXT[] := ARRAY[]::TEXT[];

  action TEXT;
  reason_code TEXT;
  lock_risk TEXT := 'LOW';

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

  empty_text TEXT := '<none>';
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_msgs_sender_date','office_messages',ARRAY['sender_id','created_at']::text[],FALSE,TRUE,NULL::text),
      ('idx_msgs_office_date','office_messages',ARRAY['office_id','created_at']::text[],FALSE,TRUE,NULL::text),
      ('idx_msgs_office_folder','office_messages',ARRAY['office_id','folder']::text[],FALSE,FALSE,NULL::text),
      ('idx_rcpt_user_unread','office_message_recipients',ARRAY['user_id','is_read']::text[],TRUE,FALSE,'is_read[[:space:]]*=[[:space:]]*false'),
      ('idx_rcpt_msg','office_message_recipients',ARRAY['message_id']::text[],FALSE,FALSE,NULL::text),
      ('idx_attach_msg','office_message_attachments',ARRAY['message_id']::text[],FALSE,FALSE,NULL::text)
    ) AS t(index_name, table_name, expected_cols, expect_partial, expect_last_desc, pred_regex)
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

    IF NOT FOUND THEN
      -- Required when base table exists; optional when table absent (no invented tables).
      IF expected_table_oid IS NOT NULL THEN
        missing_indexes := array_append(missing_indexes, spec.index_name);
      END IF;
      CONTINUE;
    END IF;

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
      incompatible_indexes := array_append(incompatible_indexes,
        format('%s(cols=%s opts=%s partial=%s)',
          spec.index_name, coalesce(index_columns::TEXT,'<null>'),
          coalesce(index_options::TEXT,'<null>'), index_partial));
    END IF;
  END LOOP;

  IF cardinality(incompatible_indexes)>0 THEN
    action := 'BLOCK_AND_MANUAL_REVIEW'; reason_code := 'INCOMPATIBLE_INDEX'; lock_risk := 'HIGH';
  ELSIF cardinality(missing_indexes)>0 THEN
    action := 'SAFE_AUTO_REPAIR'; reason_code := 'MISSING_INDEXES'; lock_risk := 'LOW';
  ELSE
    action := 'ALREADY_CORRECT'; reason_code := 'MESSAGING_RUNTIME_INDEXES_READY'; lock_risk := 'LOW';
  END IF;

  RAISE NOTICE '052_preflight: lock_risk=%', lock_risk;
  RAISE NOTICE '052_preflight: incompatible_indexes=%',
    coalesce(nullif(array_to_string(incompatible_indexes,','),''), empty_text);
  RAISE NOTICE '052_preflight: missing_indexes=%',
    coalesce(nullif(array_to_string(missing_indexes,','),''), empty_text);
  RAISE NOTICE '052_preflight: chosen_action=% reason_code=%', action, reason_code;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE EXCEPTION '052_preflight: BLOCK_AND_MANUAL_REVIEW (reason_code=%)', reason_code;
  END IF;
END
$preflight$;
