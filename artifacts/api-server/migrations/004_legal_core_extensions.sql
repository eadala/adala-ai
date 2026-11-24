-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 004: Legal Core extensions (contracts module runtime DDL)
-- Source: artifacts/api-server/src/modules/legal-core/contracts.ts ensureTables()
-- Fixes missing: contract_templates, contract_categories, contract_versions,
--                  contract_ai_history + contracts extra columns
--
-- Apply after 003:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/api-server/migrations/004_legal_core_extensions.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Contract templates ecosystem (NOT in Drizzle baseline) ─────────────────
CREATE TABLE IF NOT EXISTS contract_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   TEXT,
  name        TEXT NOT NULL,
  name_en     TEXT,
  icon        TEXT DEFAULT 'FileText',
  color       TEXT DEFAULT '#6366F1',
  is_system   BOOLEAN DEFAULT true,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES contract_categories(id) ON DELETE SET NULL,
  office_id     TEXT,
  name          TEXT NOT NULL,
  name_en       TEXT,
  description   TEXT,
  content       TEXT NOT NULL DEFAULT '',
  variables     JSONB DEFAULT '[]',
  is_system     BOOLEAN DEFAULT true,
  usage_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL,
  office_id       TEXT,
  version_number  INTEGER NOT NULL DEFAULT 1,
  content         TEXT,
  note            TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_ai_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL,
  office_id     TEXT,
  action        TEXT NOT NULL,
  prompt        TEXT,
  result        TEXT,
  model_used    TEXT,
  tokens_used   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── contracts table extensions (baseline exists in 003) ────────────────────
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS template_id       UUID;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS value_amount      TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_method    TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS lawyer_id         TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS version_number    INTEGER DEFAULT 1;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS is_locked         BOOLEAN DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS optional_clauses  JSONB DEFAULT '[]';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS compliance_score  TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS compliance_notes  TEXT;

-- ── cases extensions (boot DDL in index.ts ensureAdHocColumns) ─────────────
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source        TEXT DEFAULT 'manual';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS store_order_id TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS created_by    TEXT;

-- ── office_orders extensions ─────────────────────────────────────────────
ALTER TABLE office_orders ADD COLUMN IF NOT EXISTS auto_case_id  TEXT;
ALTER TABLE office_orders ADD COLUMN IF NOT EXISTS portal_token  TEXT;

-- ── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contract_templates_category ON contract_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_office   ON contract_templates(office_id);
CREATE INDEX IF NOT EXISTS idx_contract_versions_contract  ON contract_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_ai_history_contract ON contract_ai_history(contract_id);

COMMIT;
