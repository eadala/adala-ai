-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 030: office_messages.case_id TEXT alignment (Stage 22)
--
-- Aligns office_messages.case_id with authoritative cases.id (TEXT / UUID).
-- Migration 016 introduced case_id as INTEGER; Runtime ensureCaseIdColumn()
-- tried INTEGER REFERENCES cases(id) and silently failed.
--
-- SAFE convert only:
--   INTEGER → TEXT USING exact case_id::text (legacy 42 becomes '42')
-- Never invent integer→UUID mappings; never NULL/delete orphans.
-- Validating FK intentionally deferred (legacy orphans may exist).
--
-- chosen_action (same ladder as scripts/db/preflight-migration-030.sql):
--   ALREADY_CORRECT            — case_id already TEXT
--   SAFE_CONVERT_INTEGER_TO_TEXT — case_id INTEGER; cases.id TEXT
--   BLOCK_AND_MANUAL_REVIEW    — missing table/column or unexpected type
--
-- Lock note: ALTER COLUMN TYPE … USING rewrites the column (ACCESS EXCLUSIVE).
-- Run preflight first; if lock_risk=HIGH, schedule a maintenance window.
--
-- Apply AFTER: … → 029
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- Ops: preflight → BLOCK stop | SAFE/ALREADY apply → re-preflight ALREADY_CORRECT
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  table_present BOOLEAN;
  cases_id_udt TEXT := NULL;
  vector_col_present BOOLEAN := false;
  case_id_udt TEXT := NULL;
  case_id_nullable TEXT := NULL;
  action TEXT;
  reason_code TEXT;
  estimated_rows BIGINT := 0;
BEGIN
  table_present := to_regclass('public.office_messages') IS NOT NULL;

  IF NOT table_present THEN
    RAISE EXCEPTION
      '030_case_id: BLOCK_AND_MANUAL_REVIEW (reason_code=OFFICE_MESSAGES_MISSING) — apply Migration 016 first';
  END IF;

  SELECT c.udt_name INTO cases_id_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'cases'
    AND c.column_name = 'id'
  LIMIT 1;

  IF cases_id_udt IS NULL THEN
    RAISE EXCEPTION
      '030_case_id: BLOCK_AND_MANUAL_REVIEW (reason_code=CASES_ID_MISSING) — cases.id absent';
  END IF;

  IF cases_id_udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION
      '030_case_id: BLOCK_AND_MANUAL_REVIEW (reason_code=CASES_ID_UNEXPECTED_TYPE) — cases.id udt=%; expected text',
      cases_id_udt;
  END IF;

  SELECT
    true,
    c.udt_name,
    c.is_nullable
  INTO vector_col_present, case_id_udt, case_id_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'office_messages'
    AND c.column_name = 'case_id'
  LIMIT 1;

  IF NOT FOUND THEN
    vector_col_present := false;
    case_id_udt := NULL;
    case_id_nullable := NULL;
  END IF;

  SELECT COALESCE(c.reltuples, 0)::bigint INTO estimated_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'office_messages';

  IF NOT vector_col_present THEN
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'CASE_ID_COLUMN_MISSING';
  ELSIF case_id_udt = 'text' THEN
    action := 'ALREADY_CORRECT';
    reason_code := 'CASE_ID_ALREADY_TEXT';
  ELSIF case_id_udt = 'int4' THEN
    action := 'SAFE_CONVERT_INTEGER_TO_TEXT';
    reason_code := 'INTEGER_CASE_ID';
  ELSE
    action := 'BLOCK_AND_MANUAL_REVIEW';
    reason_code := 'UNEXPECTED_CASE_ID_TYPE';
  END IF;

  RAISE NOTICE
    '030_case_id: chosen_action=% reason_code=% case_id_udt=% cases_id_udt=% estimated_rows=%',
    action, reason_code, case_id_udt, cases_id_udt, estimated_rows;

  IF action = 'BLOCK_AND_MANUAL_REVIEW' THEN
    RAISE EXCEPTION
      '030_case_id: BLOCK_AND_MANUAL_REVIEW (reason_code=%) — refusing unsafe coercion (no invent mapping, no orphan wipe, no validating FK). Resolve manually, then re-run preflight-migration-030.sql.',
      reason_code;
  END IF;

  IF action = 'SAFE_CONVERT_INTEGER_TO_TEXT' THEN
    /* Exact textual conversion only — 42 → '42'; never UUID invent. */
    ALTER TABLE office_messages
      ALTER COLUMN case_id TYPE TEXT
      USING (
        CASE
          WHEN case_id IS NULL THEN NULL
          ELSE case_id::text
        END
      );
    RAISE NOTICE '030_case_id: converted office_messages.case_id INTEGER → TEXT (exact ::text)';
  ELSE
    RAISE NOTICE '030_case_id: ALREADY_CORRECT — case_id already TEXT; no type rewrite';
  END IF;

  /* Schema-owned index (020 formally declared; ensure present after type change). */
  CREATE INDEX IF NOT EXISTS idx_messages_case_id
    ON office_messages (case_id)
    WHERE case_id IS NOT NULL;

  RAISE NOTICE '030_case_id: ensured idx_messages_case_id (partial on case_id IS NOT NULL)';
END $$;

COMMIT;
