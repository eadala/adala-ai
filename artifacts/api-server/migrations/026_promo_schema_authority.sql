-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 026: Promo schema authority — promo_codes + gift_subscriptions
-- (Stage 16.3)
--
-- Confirmed production root cause of HTTP 500 on:
--   GET /api/promo/my-gift
-- Handlers query gift_subscriptions / promo_codes, but no prior migration
-- (or Runtime DDL) owned them. Both relations were absent in production.
--
-- Source of truth (proven from repo usage in promo.ts / subscription.ts):
--   promo_codes:
--     SELECT/INSERT/UPDATE/DELETE — promo.ts admin + redeem paths
--     columns: id, code, plan_slug, duration_days, max_uses, used_count,
--              notes, expires_at, is_active, created_at
--     UNIQUE(code) — redeem/admin unique error handling
--   gift_subscriptions:
--     SELECT/INSERT/UPDATE — promo.ts, subscription.ts
--     columns: id, office_id (UUID), user_id (TEXT), promo_code_id, plan_slug,
--              end_date, notes, status, renewed_count, created_at
--     Ownership: every new gift row MUST carry office_id + user_id.
--     Tenant reads filter by both; legacy NULL-owned rows stay invisible.
--
-- Apply AFTER: … → 025
-- Idempotent / legacy-safe:
--   - CREATE TABLE IF NOT EXISTS for fresh DBs (office_id/user_id NOT NULL)
--   - ADD COLUMN IF NOT EXISTS repairs partial legacy tables (nullable —
--     do NOT force NOT NULL until legacy NULL ownership is cleaned by ops)
--   - UNIQUE(code) skipped with WARNING if duplicate codes exist
-- Do NOT apply via Runtime DDL / drizzle-kit push.
-- Do NOT deploy/apply this file from the PR agent — ops apply out-of-band.
-- Do NOT backfill office_id/user_id from the current requester.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── promo_codes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code           TEXT NOT NULL,
  plan_slug      TEXT NOT NULL,
  duration_days  INTEGER NOT NULL,
  max_uses       INTEGER NOT NULL DEFAULT 1,
  used_count     INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS plan_slug TEXT;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS used_count INTEGER;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE promo_codes ALTER COLUMN max_uses SET DEFAULT 1;
ALTER TABLE promo_codes ALTER COLUMN used_count SET DEFAULT 0;
ALTER TABLE promo_codes ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE promo_codes ALTER COLUMN created_at SET DEFAULT NOW();

-- UNIQUE(code) for redeem/admin — skip with WARNING if duplicate codes exist
DO $$
DECLARE
  dup_cnt BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.promo_codes'::regclass
      AND contype IN ('u', 'p')
      AND pg_get_constraintdef(oid) ILIKE '%(code)%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%PRIMARY KEY%'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('promo_codes_code_key', 'uq_promo_codes_code')
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_cnt
  FROM (
    SELECT code
    FROM promo_codes
    WHERE code IS NOT NULL
    GROUP BY code
    HAVING COUNT(*) > 1
  ) d;

  IF dup_cnt > 0 THEN
    RAISE WARNING
      '026_promo: skipping UNIQUE(code) — % duplicate code value(s); cleanup required before constraint can be added',
      dup_cnt;
  ELSE
    BEGIN
      ALTER TABLE promo_codes
        ADD CONSTRAINT uq_promo_codes_code UNIQUE (code);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN invalid_table_definition THEN NULL;
    END;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_promo_codes_is_active
  ON promo_codes (is_active);

CREATE INDEX IF NOT EXISTS idx_promo_codes_expires_at
  ON promo_codes (expires_at);

-- ── gift_subscriptions ─────────────────────────────────────────────────────
-- Fresh installs: office_id + user_id are NOT NULL (new rows must be owned).
-- Legacy repair: ADD COLUMN stays nullable — never SET NOT NULL here.
CREATE TABLE IF NOT EXISTS gift_subscriptions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id       UUID NOT NULL,
  user_id         TEXT NOT NULL,
  promo_code_id   TEXT,
  plan_slug       TEXT NOT NULL,
  end_date        TIMESTAMPTZ NOT NULL,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  renewed_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS office_id UUID;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS promo_code_id TEXT;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS plan_slug TEXT;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS renewed_count INTEGER;
ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE gift_subscriptions ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE gift_subscriptions ALTER COLUMN renewed_count SET DEFAULT 0;
ALTER TABLE gift_subscriptions ALTER COLUMN created_at SET DEFAULT NOW();

-- Intentionally NO: ALTER COLUMN office_id/user_id SET NOT NULL
-- Legacy NULL-owned rows must remain until ops remaps with trusted evidence.

-- Query path for GET /promo/my-gift and subscription gift check
CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_status_end_date
  ON gift_subscriptions (status, end_date DESC);

CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_promo_code_id
  ON gift_subscriptions (promo_code_id);

CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_created_at
  ON gift_subscriptions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_office_id
  ON gift_subscriptions (office_id);

CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_user_id
  ON gift_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_office_user_status
  ON gift_subscriptions (office_id, user_id, status);

COMMIT;
