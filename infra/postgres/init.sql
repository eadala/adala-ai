-- Enable UUID generation (PostgreSQL 13+ has gen_random_uuid() built-in)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ═══════════════════════════════════════════════════════════
-- ai_workflows — UUID-native (no TEXT workaround needed here)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_workflows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    prompt      TEXT,
    graph_json  JSONB NOT NULL DEFAULT '{}',
    status      TEXT DEFAULT 'draft',
    last_run_at TIMESTAMPTZ,
    run_count   INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_workflow_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES ai_workflows(id) ON DELETE CASCADE,
    office_id   UUID NOT NULL,
    status      TEXT,
    log_entries JSONB DEFAULT '[]',
    result_json JSONB,
    started_at  TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_workflows_office ON ai_workflows(office_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_runs_wf ON ai_workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_runs_office ON ai_workflow_runs(office_id);

-- ═══════════════════════════════════════════════════════════
-- Migration mapping table (TEXT id → UUID id)
-- Used during data migration from Replit
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS _migration_id_map (
    table_name  TEXT NOT NULL,
    old_id      TEXT NOT NULL,
    new_id      UUID NOT NULL DEFAULT gen_random_uuid(),
    migrated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (table_name, old_id)
);
