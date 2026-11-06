-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 058: invitations.office_id (SEC-005 permanent office ownership)
--
-- Expand → validate → enforce (app layer). Additive only:
--   * ADD COLUMN office_id TEXT NULL (historical rows stay NULL — no invented ownership)
--   * Index for tenant list queries
-- Application must:
--   * SET office_id on new invites from trusted tenantId
--   * LIST by office_id for office tenants; NULL rows remain invited_by-scoped only
--   * Platform Super Admin may list all
-- No DROP / no rewrite of invited_by / no token changes.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.invitations') IS NULL THEN
    RAISE EXCEPTION '058_invitations_office_id: BLOCK — public.invitations missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'office_id'
  ) THEN
    ALTER TABLE public.invitations ADD COLUMN office_id text;
  END IF;

  -- Compatibility: column must be text (or varchar) nullable — never invent values
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'office_id'
      AND data_type NOT IN ('text', 'character varying')
  ) THEN
    RAISE EXCEPTION '058_invitations_office_id: BLOCK (INCOMPATIBLE_TYPE) — office_id must be text';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invitations_office_id
  ON public.invitations (office_id)
  WHERE office_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '058_invitations_office_id: post-apply READY (reason=INVITATIONS_OFFICE_ID_SCHEMA_READY)';
END $$;

COMMIT;
