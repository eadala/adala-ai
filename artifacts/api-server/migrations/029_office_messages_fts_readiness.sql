-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 029: Office Messages FTS readiness (Stage 20.3)
--
-- Follow-up to Migration 016. 016 may WARN-and-COMMIT while leaving FTS
-- unusable/incompatible. This migration only performs SAFE auto-repairs:
--   - add missing generated STORED search_vector (arabic|simple)
--   - add missing GIN idx_messages_search on search_vector
--
-- BLOCK_AND_MANUAL_REVIEW shapes abort apply (never DROP/ALTER incompatible
-- search_vector; never replace a wrong existing idx_messages_search).
--
-- Classification (same ladder as scripts/db/preflight-migration-029.sql):
--   ALREADY_CORRECT — STORED generated subject+body expression with
--     arabic|simple + valid ready non-partial GIN on search_vector
--   SAFE_AUTO_REPAIR_ADD_COLUMN — search_vector absent, subject/body present,
--     and idx_messages_search absent (name free for CREATE INDEX)
--   SAFE_AUTO_REPAIR_ADD_GIN — search_vector already authoritative; GIN missing
--   BLOCK — all incompatible legacy shapes (incl. absent vector + conflicting
--     idx_messages_search name/shape)
--
-- Post-apply readiness gate (ADD_COLUMN / ADD_GIN paths): before COMMIT,
-- re-verify GIN readiness; RAISE EXCEPTION if not (no DROP/replace).
--
-- FTS config allow-list (Stage 20.2): arabic | simple only.
-- Runtime getMessageFtsConfig() reads the live generated expression.
--
-- Production lock / rewrite notes:
--   - ADD COLUMN … GENERATED ALWAYS AS (…) STORED rewrites office_messages
--     under ACCESS EXCLUSIVE for the rewrite duration.
--   - CREATE INDEX (non-concurrent) for GIN may block writes while building.
--   - CREATE INDEX CONCURRENTLY is intentionally NOT used (cannot run inside
--     a migration transaction).
--   - Run scripts/db/preflight-migration-029.sql first; if lock_risk=HIGH,
--     schedule a maintenance window.
--
-- Apply AFTER: … → 016 (and preferably after 028 in the numbered chain)
-- Idempotent:
--   - ALREADY_CORRECT → no-op COMMIT
--   - SAFE repairs are IF NOT EXISTS / ADD COLUMN only
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- Do NOT deploy/apply this file from the PR agent — ops apply out-of-band.
--
-- Ops order:
--   1) psql -f scripts/db/preflight-migration-029.sql
--   2) if chosen_action = BLOCK_AND_MANUAL_REVIEW → stop / manual repair
--   3) if lock_risk = HIGH → schedule window
--   4) apply this migration
--   5) re-run preflight → expect ALREADY_CORRECT
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  table_present BOOLEAN;
  subject_present BOOLEAN := false;
  body_present BOOLEAN := false;
  vector_present BOOLEAN := false;
  vector_udt TEXT := NULL;
  att_generated TEXT := NULL;
  gen_expr TEXT := NULL;
  norm_expr TEXT := NULL;
  parsed_cfg TEXT := NULL;
  allowlisted BOOLEAN := false;
  expr_intended BOOLEAN := false;
  idx_present BOOLEAN := false;
  idx_am TEXT := NULL;
  idx_valid BOOLEAN := NULL;
  idx_ready BOOLEAN := NULL;
  idx_on_search_vector BOOLEAN := false;
  idx_partial BOOLEAN := false;
  idx_ready_gin BOOLEAN := false;
  estimated_rows BIGINT := 0;
  action TEXT;
  reason_code TEXT;
  fts_cfg TEXT;
BEGIN
  table_present := to_regclass('public.office_messages') IS NOT NULL;

  IF NOT table_present THEN
    RAISE EXCEPTION
      '029_fts: BLOCK_AND_MANUAL_REVIEW (reason_code=OFFICE_MESSAGES_MISSING) — apply Migration 016 first; refusing to invent office_messages';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_messages'
      AND column_name = 'subject'
  ) INTO subject_present;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_messages'
      AND column_name = 'body'
  ) INTO body_present;

  SELECT COALESCE(c.reltuples, 0)::bigint INTO estimated_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'office_messages';

  SELECT
    true,
    cols.udt_name,
    a.attgenerated::text,
    pg_get_expr(ad.adbin, ad.adrelid)
  INTO vector_present, vector_udt, att_generated, gen_expr
  FROM information_schema.columns cols
  JOIN pg_class cls
    ON cls.relname = cols.table_name
   AND cls.relnamespace = 'public'::regnamespace
  JOIN pg_attribute a
    ON a.attrelid = cls.oid
   AND a.attname = cols.column_name
   AND NOT a.attisdropped
  LEFT JOIN pg_attrdef ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
  WHERE cols.table_schema = 'public'
    AND cols.table_name = 'office_messages'
    AND cols.column_name = 'search_vector'
  LIMIT 1;

  IF NOT FOUND THEN
    vector_present := false;
    vector_udt := NULL;
    att_generated := NULL;
    gen_expr := NULL;
  END IF;

  IF gen_expr IS NOT NULL THEN
    parsed_cfg := (regexp_match(gen_expr, 'to_tsvector\(\s*''([^'']+)''', 'i'))[1];
    /* Strip ::regconfig / ::text casts; compare intended subject+body shape. */
    norm_expr := lower(regexp_replace(gen_expr, '::[a-z_]+', '', 'g'));
  END IF;
  allowlisted := parsed_cfg IN ('arabic', 'simple');
  expr_intended := allowlisted AND norm_expr IN (
    'to_tsvector(''arabic'', ((coalesce(subject, '''') || '' '') || coalesce(body, '''')))',
    'to_tsvector(''simple'', ((coalesce(subject, '''') || '' '') || coalesce(body, '''')))'
  );

  SELECT
    true,
    am.amname,
    x.indisvalid,
    x.indisready,
    EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = x.indrelid
        AND a.attnum = x.indkey[0]
        AND NOT a.attisdropped
        AND a.attname = 'search_vector'
    ) AND x.indnkeyatts = 1 AND x.indexprs IS NULL,
    x.indpred IS NOT NULL
  INTO idx_present, idx_am, idx_valid, idx_ready, idx_on_search_vector, idx_partial
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_am am ON am.oid = i.relam
  WHERE n.nspname = 'public'
    AND t.relname = 'office_messages'
    AND i.relname = 'idx_messages_search'
  LIMIT 1;

  IF NOT FOUND THEN
    idx_present := false;
    idx_am := NULL;
    idx_valid := NULL;
    idx_ready := NULL;
    idx_on_search_vector := false;
    idx_partial := false;
  END IF;

  idx_ready_gin :=
    idx_present
    AND idx_am = 'gin'
    AND idx_on_search_vector
    AND NOT idx_partial
    AND idx_valid IS TRUE
    AND idx_ready IS TRUE;

  /* Classification priority — must match preflight-migration-029.sql. */
  IF NOT vector_present THEN
    IF NOT (subject_present AND body_present) THEN
      action := 'BLOCK_AND_MANUAL_REVIEW';
      reason_code := 'SUBJECT_OR_BODY_MISSING';
    ELSIF idx_present AND NOT idx_ready_gin THEN
      /* Name taken by incompatible index → CREATE INDEX IF NOT EXISTS would
         skip and leave FTS without a usable GIN. Never SAFE_ADD_COLUMN. */
      action := 'BLOCK_AND_MANUAL_REVIEW';
      IF idx_am IS DISTINCT FROM 'gin' THEN
        reason_code := 'WRONG_INDEX_AM';
      ELSIF idx_partial THEN
        reason_code := 'PARTIAL_INDEX';
      ELSIF NOT idx_on_search_vector THEN
        reason_code := 'WRONG_INDEX_DEFINITION';
      ELSIF idx_valid IS NOT TRUE OR idx_ready IS NOT TRUE THEN
        reason_code := 'INDEX_NOT_VALID_OR_NOT_READY';
      ELSE
        reason_code := 'CONFLICTING_INDEX_NAME';
      END IF;
    ELSE
      action := 'SAFE_AUTO_REPAIR_ADD_COLUMN';
      reason_code := 'SEARCH_VECTOR_ABSENT';
    END IF;
  ELSIF vector_udt IS DISTINCT FROM 'tsvector' THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'WRONG_SEARCH_VECTOR_TYPE';
  ELSIF att_generated IS DISTINCT FROM 's' THEN
    /* Require STORED generated ('s'); virtual ('v') and plain columns block. */
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := CASE
      WHEN att_generated = 'v' THEN 'NON_STORED_GENERATED'
      ELSE 'NON_GENERATED_TSVECTOR'
    END;
  ELSIF parsed_cfg IS NULL THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'UNPARSEABLE_GENERATED_EXPRESSION';
  ELSIF NOT allowlisted THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'UNSUPPORTED_FTS_CONFIG';
  ELSIF NOT expr_intended THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'WRONG_GENERATED_EXPRESSION';
  ELSIF NOT idx_present THEN
    action := 'SAFE_AUTO_REPAIR_ADD_GIN';
    reason_code := 'GIN_MISSING';
  ELSIF idx_am IS DISTINCT FROM 'gin' THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'WRONG_INDEX_AM';
  ELSIF idx_partial THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'PARTIAL_INDEX';
  ELSIF NOT idx_on_search_vector THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'WRONG_INDEX_DEFINITION';
  ELSIF idx_valid IS NOT TRUE OR idx_ready IS NOT TRUE THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'INDEX_NOT_VALID_OR_NOT_READY';
  ELSE
    action := 'ALREADY_CORRECT';
    reason_code := 'FTS_READY';
  END IF;

  RAISE NOTICE
    '029_fts: chosen_action=% reason_code=% estimated_rows=% (ADD GENERATED STORED may rewrite; GIN build may block writes)',
    action, reason_code, estimated_rows;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE EXCEPTION
      '029_fts: BLOCK_AND_MANUAL_REVIEW (reason_code=%) — refusing destructive repair (no column/index drop, type rewrite, or config force). Resolve manually, then re-run preflight-migration-029.sql.',
      reason_code;
  END IF;

  IF action = 'ALREADY_CORRECT' THEN
    RAISE NOTICE '029_fts: ALREADY_CORRECT — no-op';
    RETURN;
  END IF;

  IF action = 'SAFE_AUTO_REPAIR_ADD_COLUMN' THEN
    /* Never DROP an existing incompatible column — this branch only runs when absent. */
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'arabic') THEN 'arabic'
      ELSE 'simple'
    END INTO fts_cfg;

    EXECUTE format(
      'ALTER TABLE office_messages ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector(%L, coalesce(subject, '''') || '' '' || coalesce(body, ''''))) STORED',
      fts_cfg
    );
    RAISE NOTICE '029_fts: added generated STORED search_vector with config=%', fts_cfg;

    CREATE INDEX IF NOT EXISTS idx_messages_search
      ON office_messages USING gin (search_vector);
    RAISE NOTICE '029_fts: ensured GIN idx_messages_search after column add';
  ELSIF action = 'SAFE_AUTO_REPAIR_ADD_GIN' THEN
    /* Index name must not already exist with a wrong AM/def — that is BLOCK. */
    CREATE INDEX IF NOT EXISTS idx_messages_search
      ON office_messages USING gin (search_vector);
    RAISE NOTICE '029_fts: added GIN idx_messages_search';
  ELSE
    RAISE EXCEPTION '029_fts: unexpected chosen_action=%', action;
  END IF;

  /* Post-apply readiness gate — fail closed before COMMIT; never DROP/replace. */
  SELECT
    true,
    am.amname,
    x.indisvalid,
    x.indisready,
    EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = x.indrelid
        AND a.attnum = x.indkey[0]
        AND NOT a.attisdropped
        AND a.attname = 'search_vector'
    ) AND x.indnkeyatts = 1 AND x.indexprs IS NULL,
    x.indpred IS NOT NULL
  INTO idx_present, idx_am, idx_valid, idx_ready, idx_on_search_vector, idx_partial
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_am am ON am.oid = i.relam
  WHERE n.nspname = 'public'
    AND t.relname = 'office_messages'
    AND i.relname = 'idx_messages_search'
  LIMIT 1;

  IF NOT FOUND THEN
    idx_present := false;
    idx_am := NULL;
    idx_valid := NULL;
    idx_ready := NULL;
    idx_on_search_vector := false;
    idx_partial := false;
  END IF;

  idx_ready_gin :=
    idx_present
    AND idx_am = 'gin'
    AND idx_on_search_vector
    AND NOT idx_partial
    AND idx_valid IS TRUE
    AND idx_ready IS TRUE;

  IF NOT idx_ready_gin THEN
    RAISE EXCEPTION
      '029_fts: POST_APPLY_READINESS_FAILED — idx_messages_search is not a valid ready non-partial GIN on search_vector (am=% on_search_vector=% partial=% valid=% ready=%). Refusing COMMIT; no DROP/replace of existing index.',
      idx_am, idx_on_search_vector, idx_partial, idx_valid, idx_ready;
  END IF;

  RAISE NOTICE '029_fts: post-apply readiness gate passed (GIN ready on search_vector)';
END $$;

COMMIT;
