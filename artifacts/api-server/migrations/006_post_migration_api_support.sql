-- ═══════════════════════════════════════════════════════════════════════════
-- 006_post_migration_api_support.sql
-- Post-migration API support: login_logs + office_page.website_config
--
-- Apply AFTER: 003 → 001 → 004 → 005
-- Idempotent: safe to run multiple times on Production.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── login_logs — used by loginTracking.ts, soc.ts, admin.ts, launchGate ───
CREATE TABLE IF NOT EXISTS login_logs (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL,
  email        TEXT,
  full_name    TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  browser      TEXT,
  os           TEXT,
  device_type  TEXT,
  status       TEXT NOT NULL DEFAULT 'success',
  office_id    TEXT DEFAULT 'default',
  session_id   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_office_id
  ON login_logs (office_id);

CREATE INDEX IF NOT EXISTS idx_login_logs_created_at
  ON login_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_logs_status_created_at
  ON login_logs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id
  ON login_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_login_logs_session_id
  ON login_logs (session_id)
  WHERE session_id IS NOT NULL;

-- ── office_page.website_config — Drizzle schema (lib/db/src/schema/office.ts) ─
--   websiteConfig: jsonb("website_config").default({})
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'office_page'
  ) THEN
    ALTER TABLE office_page
      ADD COLUMN IF NOT EXISTS website_config JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;
