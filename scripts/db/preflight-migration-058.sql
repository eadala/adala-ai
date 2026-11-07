-- Preflight 058 — SELECT-only. Does not CREATE / ALTER / DROP durable objects.
-- Outcomes: SAFE_AUTO_REPAIR | ALREADY | BLOCK_AND_MANUAL_REVIEW

\echo '058 preflight: invitations.office_id'

SELECT
  CASE
    WHEN to_regclass('public.invitations') IS NULL THEN 'BLOCK_AND_MANUAL_REVIEW'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'office_id'
        AND data_type IN ('text', 'character varying')
    ) THEN 'ALREADY'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'office_id'
        AND data_type NOT IN ('text', 'character varying')
    ) THEN 'BLOCK_AND_MANUAL_REVIEW'
    ELSE 'SAFE_AUTO_REPAIR'
  END AS status,
  'INVITATIONS_OFFICE_ID_SCHEMA_READY' AS ready_token;
