-- =============================================================================
-- 024_tasks_tenant_ownership.sql
-- Stage 15 — Strict tasks.office_id ownership + legacy orphan cleanup
--
-- APPLY ORDER (mandatory):
--   1) Migration 023 (023_trial_uuid_offices.sql) MUST be applied first.
--   2) This migration (024) runs ONLY after 023.
--   Do NOT apply this file while legacy trial_* cases remain — those case
--   office_ids must already be remapped to canonical UUIDs by Migration 023.
--   Applying 024 before 023 silently quarantines NULL tasks linked to
--   trial_* cases that 023 would have made backfillable.
--
-- PRODUCTION GATE — Autopilot:
--   Autopilot UUID office writes must be deployed BEFORE production apply of
--   this migration. After SET NOT NULL, Autopilot paths that omit office_id
--   will fail (errors may be swallowed). Autopilot hardening is a separate PR;
--   do not apply 024 until that deploy is live (or Autopilot create is disabled).
--
-- Root cause of NULL office_id (code evidence):
--   1) POST /office-tasks inserted NULL when toUuid(tenantId) failed
--      (trial_*, platform, default, non-UUID tenants).
--   2) caseAutopilot createAutopilotTasks omitted office_id (and case_id).
--
-- Trusted backfill (unambiguous only — do NOT use logged-in tenant):
--   A) tasks.case_id → cases.id → cases.office_id
--      when cases.office_id is a UUID-shaped non-null value
--   B) tasks.branch_id → office_branches.id → office_branches.office_id
--      only when still NULL and office is UUID-shaped; skip if case-derived
--      office would conflict (case join disagrees with branch)
--
-- Ambiguous remainder (no safe owner):
--   Moved to tasks_orphan_quarantine (data preserved; not tenant-visible).
--   Includes autopilot stubs without case_id and rows whose case/branch
--   office is missing or non-UUID. NOT deleted.
--
-- Fail closed:
--   After quarantine, any remaining tasks.office_id IS NULL aborts migration.
--   Then SET NOT NULL. FK to office_page skipped (TEXT vs UUID / trial keys).
--
-- Idempotent: safe to re-run (quarantine table IF NOT EXISTS; backfill only
-- where office_id IS NULL; SET NOT NULL is a no-op when already set).
-- =============================================================================

BEGIN;

-- ── Quarantine table (preserves unresolved orphans; not exposed via API) ───
CREATE TABLE IF NOT EXISTS tasks_orphan_quarantine (
  id              UUID PRIMARY KEY,
  office_id       TEXT,
  title           TEXT,
  description     TEXT,
  status          TEXT,
  priority        TEXT,
  assignee_name   TEXT,
  assigned_to     TEXT,
  due_date        DATE,
  case_id         TEXT,
  case_title      TEXT,
  created_by      TEXT,
  tags            TEXT[],
  branch_id       UUID,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  quarantined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quarantine_reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_orphan_quarantine_reason
  ON tasks_orphan_quarantine (quarantine_reason);

DO $$
DECLARE
  uuid_re          CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  total_null       INT := 0;
  backfilled_case  INT := 0;
  backfilled_branch INT := 0;
  unresolved       INT := 0;
  quarantined      INT := 0;
  remaining_null   INT := 0;
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE NOTICE '024_tasks: tasks table missing — skipping';
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO total_null FROM tasks WHERE office_id IS NULL;
  RAISE NOTICE '024_tasks: total NULL office_id rows = %', total_null;

  -- ── A) Unambiguous backfill via case ownership ───────────────────────────
  WITH updated AS (
    UPDATE tasks t
    SET office_id = c.office_id,
        updated_at = COALESCE(t.updated_at, NOW())
    FROM cases c
    WHERE t.office_id IS NULL
      AND t.case_id IS NOT NULL
      AND t.case_id = c.id::text
      AND c.office_id IS NOT NULL
      AND c.office_id ~* uuid_re
    RETURNING t.id
  )
  SELECT COUNT(*)::int INTO backfilled_case FROM updated;
  RAISE NOTICE '024_tasks: backfilled via case_id→cases.office_id = %', backfilled_case;

  -- ── B) Unambiguous backfill via branch (no conflicting case office) ──────
  IF to_regclass('public.office_branches') IS NOT NULL THEN
    WITH updated AS (
      UPDATE tasks t
      SET office_id = b.office_id,
          updated_at = COALESCE(t.updated_at, NOW())
      FROM office_branches b
      WHERE t.office_id IS NULL
        AND t.branch_id IS NOT NULL
        AND t.branch_id = b.id
        AND b.office_id IS NOT NULL
        AND b.office_id ~* uuid_re
        AND NOT EXISTS (
          SELECT 1
          FROM cases c
          WHERE t.case_id IS NOT NULL
            AND t.case_id = c.id::text
            AND c.office_id IS NOT NULL
            AND lower(c.office_id) <> lower(b.office_id)
        )
      RETURNING t.id
    )
    SELECT COUNT(*)::int INTO backfilled_branch FROM updated;
  ELSE
    backfilled_branch := 0;
  END IF;
  RAISE NOTICE '024_tasks: backfilled via branch_id→office_branches.office_id = %', backfilled_branch;

  SELECT COUNT(*)::int INTO unresolved FROM tasks WHERE office_id IS NULL;
  RAISE NOTICE '024_tasks: unresolved after trusted backfill = %', unresolved;

  -- ── Quarantine ambiguous orphans (preserve; do not delete) ───────────────
  WITH moved AS (
    INSERT INTO tasks_orphan_quarantine (
      id, office_id, title, description, status, priority,
      assignee_name, assigned_to, due_date, case_id, case_title,
      created_by, tags, branch_id, created_at, updated_at,
      quarantine_reason
    )
    SELECT
      t.id, t.office_id, t.title, t.description, t.status, t.priority,
      t.assignee_name, t.assigned_to, t.due_date, t.case_id, t.case_title,
      t.created_by, t.tags, t.branch_id, t.created_at, t.updated_at,
      CASE
        WHEN t.created_by = 'autopilot' AND t.case_id IS NULL
          THEN 'autopilot_missing_office_and_case'
        WHEN t.case_id IS NOT NULL
          THEN 'case_office_missing_or_non_uuid'
        WHEN t.branch_id IS NOT NULL
          THEN 'branch_office_missing_or_conflict'
        ELSE 'ambiguous_orphan_no_trusted_relation'
      END
    FROM tasks t
    WHERE t.office_id IS NULL
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::int INTO quarantined FROM moved;

  DELETE FROM tasks t
  WHERE t.office_id IS NULL
    AND EXISTS (SELECT 1 FROM tasks_orphan_quarantine q WHERE q.id = t.id);

  RAISE NOTICE '024_tasks: quarantined unresolved rows = %', quarantined;

  SELECT COUNT(*)::int INTO remaining_null FROM tasks WHERE office_id IS NULL;
  RAISE NOTICE
    '024_tasks summary: total_null=% backfilled_case=% backfilled_branch=% unresolved=% quarantined=% remaining_null=%',
    total_null, backfilled_case, backfilled_branch, unresolved, quarantined, remaining_null;

  IF remaining_null > 0 THEN
    RAISE EXCEPTION
      '024_tasks: % tasks still have office_id IS NULL after quarantine — fail closed (inspect production; do not invent owners)',
      remaining_null;
  END IF;

  -- ── Harden: NOT NULL ──────────────────────────────────────────────────────
  BEGIN
    ALTER TABLE tasks ALTER COLUMN office_id SET NOT NULL;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION '024_tasks: ALTER office_id SET NOT NULL failed: %', SQLERRM;
  END;

  RAISE NOTICE '024_tasks: tasks.office_id is NOT NULL';
END $$;

-- Index (001/015 may already have variants — IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_tasks_office_id ON tasks (office_id);

-- FK to office_page intentionally omitted:
--   tasks.office_id is TEXT; office_page.id is UUID; historical trial_* tenant
--   keys are incompatible with a strict UUID FK. Ownership is enforced in app
--   + NOT NULL. Revisit FK only after a dedicated office-id unification stage.

COMMIT;
