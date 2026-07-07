-- PR-TNT-002: Tenant lifecycle columns on office_registry
ALTER TABLE office_registry
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS frozen_by TEXT;

CREATE INDEX IF NOT EXISTS idx_office_registry_lifecycle ON office_registry(lifecycle_status);

ALTER TABLE office_members
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
