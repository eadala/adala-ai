-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 005: Tenant resolution + platform tables (no Drizzle baseline)
-- These tables are referenced at runtime but never had formal CREATE in repo.
-- Critical for: tenantMiddleware, tenantResolver, goLiveMetrics, onboarding
--
-- Apply after 004:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/api-server/migrations/005_tenant_platform_tables.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── office_members — NO CREATE TABLE existed in codebase (schema gap) ────
-- Used by: tenantMiddleware, tenantResolver, onboarding, admin, saas-os
CREATE TABLE IF NOT EXISTS office_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'lawyer',
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (office_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_office_members_office_id ON office_members(office_id);
CREATE INDEX IF NOT EXISTS idx_office_members_user_id   ON office_members(user_id);
CREATE INDEX IF NOT EXISTS idx_office_members_status    ON office_members(status);

-- ── trial_offices — onboarding.ts / trialOnboarding.ts ─────────────────────
CREATE TABLE IF NOT EXISTS trial_offices (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE,
  office_id     TEXT NOT NULL,
  office_name   TEXT NOT NULL DEFAULT '',
  specialty     TEXT NOT NULL DEFAULT '',
  office_size   TEXT NOT NULL DEFAULT 'solo',
  trial_start   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  converted     BOOLEAN NOT NULL DEFAULT FALSE,
  converted_at  TIMESTAMPTZ,
  setup_data    JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_offices_office_id ON trial_offices(office_id);

-- ── onboarding_state — onboarding.ts ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_state (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL UNIQUE,
  office_id   TEXT NOT NULL DEFAULT 'default',
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  step        INTEGER NOT NULL DEFAULT 0,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── system_events — eventBus.ts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  office_id   TEXT DEFAULT 'default',
  actor_id    TEXT,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type    ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_office  ON system_events(office_id);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at DESC);

-- ── plan_cms — planCms.ts (pricing / go-live) ─────────────────────────────
CREATE TABLE IF NOT EXISTS plan_cms (
  id              TEXT PRIMARY KEY,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  monthly_price   INTEGER NOT NULL DEFAULT 0,
  yearly_price    INTEGER NOT NULL DEFAULT 0,
  color           TEXT NOT NULL DEFAULT '#64748B',
  description     TEXT,
  badge           TEXT,
  features        JSONB NOT NULL DEFAULT '[]',
  recommended     BOOLEAN NOT NULL DEFAULT false,
  is_contact_only BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_cms ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}';
ALTER TABLE plan_cms ADD COLUMN IF NOT EXISTS limits        JSONB NOT NULL DEFAULT '{}';

-- ── users.office_id — tenantMiddleware step 4 ──────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS office_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_office_id ON users(office_id);

-- ── office_registry index for tenant resolution ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_office_registry_clerk_user ON office_registry(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_office_registry_status     ON office_registry(status);

COMMIT;
