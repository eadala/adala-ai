-- ═══════════════════════════════════════════════════════════════════════════
-- 006_post_migration_api_support.sql
-- Post-migration API support:
--   login_logs, office_page.website_config, web_vitals, route_analytics
--
-- Apply AFTER: 003 → 001 → 004 → 005
-- Idempotent: safe to run multiple times on Production.
-- Columns/indexes derived from actual INSERT/SELECT usage in codebase.
-- No guessed CHECK/UNIQUE constraints beyond primary key.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── login_logs ─────────────────────────────────────────────────────────────
-- Used by: loginTracking.ts, soc.ts, admin.ts, launchGate.ts, dashboard.ts,
--          control-tower.ts, engineering.ts, executiveDashboard.ts
-- INSERT columns: user_id, email, full_name, ip_address, user_agent, browser,
--                 os, device_type, status, office_id, session_id
-- SELECT filters: office_id, status, created_at, user_id, session_id, device_type, os
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

-- ── office_page.website_config ─────────────────────────────────────────────
-- ADOPTED column: Drizzle officePageTable.websiteConfig + websiteBuilder.ts
--                 + office-public.tsx + website templates
-- Type/default match Drizzle: jsonb("website_config").default({})
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

-- ── web_vitals ─────────────────────────────────────────────────────────────
-- Used by: routes/metrics.ts POST/GET /metrics/vitals
-- INSERT: name, value, rating, url
-- CHECK on rating matches metrics.ts validRatings (proven by INSERT validation)
CREATE TABLE IF NOT EXISTS web_vitals (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  value       NUMERIC NOT NULL,
  rating      TEXT NOT NULL CHECK (rating IN ('good','needs-improvement','poor')),
  url         TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_created_at
  ON web_vitals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_vitals_name_created_at
  ON web_vitals (name, created_at DESC);

-- ── route_analytics ────────────────────────────────────────────────────────
-- Used by: routes/metrics.ts POST/GET /metrics/route-analytics
-- INSERT: path, name_internal, module, load_ms, visited_at
CREATE TABLE IF NOT EXISTS route_analytics (
  id            SERIAL PRIMARY KEY,
  path          TEXT NOT NULL,
  name_internal TEXT,
  module        TEXT,
  load_ms       INTEGER,
  visited_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_analytics_path
  ON route_analytics (path);

CREATE INDEX IF NOT EXISTS idx_route_analytics_visited_at
  ON route_analytics (visited_at DESC);
