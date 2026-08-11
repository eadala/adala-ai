-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 034: JLWM Core schema authority (Stage 4B)
--
-- Owns exactly the 14 tables previously created by ensureJLWMSchema():
--   jlwm_config
--   jlwm_memory_nodes (+ partial UNIQUE idx_jmn_uniq)
--   jlwm_memory_edges (+ FK → nodes ON DELETE CASCADE; legacy-safe defer)
--   jlwm_world_states
--   jlwm_legal_patterns
--   jlwm_command_sessions
--   jlwm_command_actions
--   jlwm_case_twins     UNIQUE(office_id, case_id)
--   jlwm_client_twins   UNIQUE(office_id, client_id)
--   jlwm_firm_twin      UNIQUE(office_id, snapshot_date)
--   jlwm_predictions
--   jlwm_recommendations
--   jlwm_radar_alerts
--   jlwm_feedback
--
-- Does NOT own JLWM satellites (035) or Reliability tables (036).
-- Does NOT invent UNIQUE arbiters for targetless ON CONFLICT DO NOTHING paths.
-- Does NOT invent/remap/delete tenant office_id values.
-- Idempotent and fail-closed. Post-apply readiness must pass before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1) jlwm_config ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_config (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id           TEXT NOT NULL UNIQUE,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  enabled_modules     TEXT[]  NOT NULL DEFAULT ARRAY['memory_graph','world_state','command_center'],
  sync_frequency      TEXT    NOT NULL DEFAULT 'hourly',
  ai_model            TEXT    NOT NULL DEFAULT 'gemini',
  last_full_sync_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS enabled BOOLEAN;
ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS enabled_modules TEXT[];
ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS sync_frequency TEXT;
ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS ai_model TEXT;
ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS last_full_sync_at TIMESTAMPTZ;
ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── 2) jlwm_memory_nodes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_memory_nodes (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id        TEXT NOT NULL,
  node_type        TEXT NOT NULL,
  node_ref         TEXT,
  label            TEXT NOT NULL,
  properties       JSONB NOT NULL DEFAULT '{}',
  importance_score FLOAT NOT NULL DEFAULT 0.5,
  is_auto          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS node_type TEXT;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS node_ref TEXT;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS properties JSONB;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS importance_score FLOAT;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS is_auto BOOLEAN;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_memory_nodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── 3) jlwm_memory_edges (FK installed later after orphan check) ───────────
CREATE TABLE IF NOT EXISTS jlwm_memory_edges (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id    TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id   TEXT NOT NULL,
  edge_type    TEXT NOT NULL,
  weight       FLOAT NOT NULL DEFAULT 0.5,
  evidence     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_memory_edges ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_memory_edges ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_memory_edges ADD COLUMN IF NOT EXISTS from_node_id TEXT;
ALTER TABLE jlwm_memory_edges ADD COLUMN IF NOT EXISTS to_node_id TEXT;
ALTER TABLE jlwm_memory_edges ADD COLUMN IF NOT EXISTS edge_type TEXT;
ALTER TABLE jlwm_memory_edges ADD COLUMN IF NOT EXISTS weight FLOAT;
ALTER TABLE jlwm_memory_edges ADD COLUMN IF NOT EXISTS evidence JSONB;
ALTER TABLE jlwm_memory_edges ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── 4) jlwm_world_states ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_world_states (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id       TEXT NOT NULL,
  risk_level      TEXT NOT NULL DEFAULT 'green',
  state_vector    JSONB NOT NULL DEFAULT '{}',
  active_threats  JSONB NOT NULL DEFAULT '[]',
  opportunities   JSONB NOT NULL DEFAULT '[]',
  state_summary   TEXT,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  triggered_by    TEXT NOT NULL DEFAULT 'auto'
);

ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS state_vector JSONB;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS active_threats JSONB;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS opportunities JSONB;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS state_summary TEXT;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE jlwm_world_states ADD COLUMN IF NOT EXISTS triggered_by TEXT;

-- ── 5) jlwm_legal_patterns ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_legal_patterns (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id        TEXT NOT NULL,
  pattern_type     TEXT NOT NULL,
  pattern_name     TEXT NOT NULL,
  description      TEXT,
  evidence_count   INT  NOT NULL DEFAULT 1,
  confidence_score FLOAT NOT NULL DEFAULT 0.5,
  applies_to       JSONB NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS pattern_type TEXT;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS pattern_name TEXT;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS evidence_count INT;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS applies_to JSONB;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;
ALTER TABLE jlwm_legal_patterns ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ── 6) jlwm_command_sessions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_command_sessions (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  query        TEXT NOT NULL,
  response     TEXT,
  context_used JSONB NOT NULL DEFAULT '{}',
  model_used   TEXT,
  tokens_est   INT  NOT NULL DEFAULT 0,
  duration_ms  INT,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS query TEXT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS context_used JSONB;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS tokens_est INT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS duration_ms INT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE jlwm_command_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── 7) jlwm_command_actions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_command_actions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id   TEXT NOT NULL,
  user_id     TEXT,
  action_type TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  result      JSONB NOT NULL DEFAULT '{}',
  error_msg   TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS error_msg TEXT;
ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE jlwm_command_actions ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- ── 8) jlwm_case_twins ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_case_twins (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id             TEXT NOT NULL,
  case_id               TEXT NOT NULL,
  health_score          FLOAT NOT NULL DEFAULT 50,
  complexity_score      FLOAT NOT NULL DEFAULT 50,
  risk_level            TEXT  NOT NULL DEFAULT 'medium',
  predicted_outcome     TEXT,
  outcome_confidence    FLOAT NOT NULL DEFAULT 0,
  predicted_duration_days INT,
  financial_exposure    FLOAT NOT NULL DEFAULT 0,
  key_entities          JSONB NOT NULL DEFAULT '[]',
  critical_dates        JSONB NOT NULL DEFAULT '[]',
  strengths             TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  weaknesses            TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  opportunities         TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  state_data            JSONB NOT NULL DEFAULT '{}',
  last_synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(office_id, case_id)
);

ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS health_score FLOAT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS complexity_score FLOAT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS predicted_outcome TEXT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS outcome_confidence FLOAT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS predicted_duration_days INT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS financial_exposure FLOAT;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS key_entities JSONB;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS critical_dates JSONB;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS strengths TEXT[];
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS weaknesses TEXT[];
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS opportunities TEXT[];
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS state_data JSONB;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_case_twins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── 9) jlwm_client_twins ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_client_twins (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id            TEXT NOT NULL,
  client_id            TEXT NOT NULL,
  loyalty_score        FLOAT NOT NULL DEFAULT 50,
  risk_score           FLOAT NOT NULL DEFAULT 50,
  ltv_score            FLOAT NOT NULL DEFAULT 0,
  total_cases          INT   NOT NULL DEFAULT 0,
  won_cases            INT   NOT NULL DEFAULT 0,
  lost_cases           INT   NOT NULL DEFAULT 0,
  active_cases         INT   NOT NULL DEFAULT 0,
  total_invoiced       FLOAT NOT NULL DEFAULT 0,
  total_paid           FLOAT NOT NULL DEFAULT 0,
  payment_reliability  FLOAT NOT NULL DEFAULT 1,
  churn_risk           TEXT  NOT NULL DEFAULT 'low',
  predicted_next_case  TIMESTAMPTZ,
  behavioral_patterns  JSONB NOT NULL DEFAULT '{}',
  last_synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(office_id, client_id)
);

ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS loyalty_score FLOAT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS risk_score FLOAT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS ltv_score FLOAT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS total_cases INT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS won_cases INT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS lost_cases INT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS active_cases INT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS total_invoiced FLOAT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS total_paid FLOAT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS payment_reliability FLOAT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS churn_risk TEXT;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS predicted_next_case TIMESTAMPTZ;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS behavioral_patterns JSONB;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_client_twins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── 10) jlwm_firm_twin ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_firm_twin (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id               TEXT NOT NULL,
  performance_score       FLOAT NOT NULL DEFAULT 50,
  efficiency_score        FLOAT NOT NULL DEFAULT 50,
  health_score            FLOAT NOT NULL DEFAULT 50,
  monthly_revenue         FLOAT NOT NULL DEFAULT 0,
  revenue_trend           FLOAT NOT NULL DEFAULT 0,
  active_cases_count      INT   NOT NULL DEFAULT 0,
  avg_case_duration_days  FLOAT NOT NULL DEFAULT 0,
  win_rate_pct            FLOAT NOT NULL DEFAULT 0,
  client_satisfaction     FLOAT NOT NULL DEFAULT 50,
  top_case_types          JSONB NOT NULL DEFAULT '[]',
  resource_utilization    JSONB NOT NULL DEFAULT '{}',
  financial_health        JSONB NOT NULL DEFAULT '{}',
  growth_indicators       JSONB NOT NULL DEFAULT '{}',
  snapshot_date           DATE  NOT NULL DEFAULT CURRENT_DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(office_id, snapshot_date)
);

ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS performance_score FLOAT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS efficiency_score FLOAT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS health_score FLOAT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS monthly_revenue FLOAT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS revenue_trend FLOAT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS active_cases_count INT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS avg_case_duration_days FLOAT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS win_rate_pct FLOAT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS client_satisfaction FLOAT;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS top_case_types JSONB;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS resource_utilization JSONB;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS financial_health JSONB;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS growth_indicators JSONB;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS snapshot_date DATE;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_firm_twin ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── 11) jlwm_predictions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_predictions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id        TEXT NOT NULL,
  subject_type     TEXT NOT NULL,
  subject_id       TEXT,
  prediction_type  TEXT NOT NULL,
  predicted_value  TEXT NOT NULL,
  confidence_score FLOAT NOT NULL DEFAULT 0,
  supporting_data  JSONB NOT NULL DEFAULT '{}',
  model_used       TEXT,
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  actual_value     TEXT,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS subject_type TEXT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS subject_id TEXT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS prediction_type TEXT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS predicted_value TEXT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS supporting_data JSONB;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS is_verified BOOLEAN;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS actual_value TEXT;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_predictions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── 12) jlwm_recommendations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_recommendations (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id        TEXT NOT NULL,
  target_type      TEXT NOT NULL DEFAULT 'firm',
  target_id        TEXT,
  category         TEXT NOT NULL,
  priority         TEXT NOT NULL DEFAULT 'medium',
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  action_items     JSONB NOT NULL DEFAULT '[]',
  estimated_impact TEXT,
  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  is_applied       BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed        BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS action_items JSONB;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS estimated_impact TEXT;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS is_read BOOLEAN;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS is_applied BOOLEAN;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS dismissed BOOLEAN;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_recommendations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── 13) jlwm_radar_alerts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_radar_alerts (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id          TEXT NOT NULL,
  alert_type         TEXT NOT NULL,
  severity           TEXT NOT NULL DEFAULT 'warning',
  subject_type       TEXT,
  subject_id         TEXT,
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  action_url         TEXT,
  is_acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by    TEXT,
  acknowledged_at    TIMESTAMPTZ,
  auto_resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS alert_type TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS subject_type TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS subject_id TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS acknowledged_by TEXT;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS auto_resolved BOOLEAN;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_radar_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── 14) jlwm_feedback ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jlwm_feedback (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id        TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  source_type      TEXT NOT NULL,
  source_id        TEXT NOT NULL,
  rating           INT,
  was_accurate     BOOLEAN,
  was_useful       BOOLEAN,
  user_action      TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS rating INT;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS was_accurate BOOLEAN;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS was_useful BOOLEAN;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS user_action TEXT;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE jlwm_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation (no coercion) + NULL/duplicate ownership + defaults/NOT NULL
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
  non_uuid_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
  uuid_re CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- config
      ('jlwm_config','id','text'),
      ('jlwm_config','office_id','text'),
      ('jlwm_config','enabled','bool'),
      ('jlwm_config','enabled_modules','_text'),
      ('jlwm_config','sync_frequency','text'),
      ('jlwm_config','ai_model','text'),
      ('jlwm_config','last_full_sync_at','timestamptz'),
      ('jlwm_config','created_at','timestamptz'),
      ('jlwm_config','updated_at','timestamptz'),
      -- memory_nodes
      ('jlwm_memory_nodes','id','text'),
      ('jlwm_memory_nodes','office_id','text'),
      ('jlwm_memory_nodes','node_type','text'),
      ('jlwm_memory_nodes','node_ref','text'),
      ('jlwm_memory_nodes','label','text'),
      ('jlwm_memory_nodes','properties','jsonb'),
      ('jlwm_memory_nodes','importance_score','float8'),
      ('jlwm_memory_nodes','is_auto','bool'),
      ('jlwm_memory_nodes','created_at','timestamptz'),
      ('jlwm_memory_nodes','updated_at','timestamptz'),
      -- memory_edges
      ('jlwm_memory_edges','id','text'),
      ('jlwm_memory_edges','office_id','text'),
      ('jlwm_memory_edges','from_node_id','text'),
      ('jlwm_memory_edges','to_node_id','text'),
      ('jlwm_memory_edges','edge_type','text'),
      ('jlwm_memory_edges','weight','float8'),
      ('jlwm_memory_edges','evidence','jsonb'),
      ('jlwm_memory_edges','created_at','timestamptz'),
      -- world_states
      ('jlwm_world_states','id','text'),
      ('jlwm_world_states','office_id','text'),
      ('jlwm_world_states','risk_level','text'),
      ('jlwm_world_states','state_vector','jsonb'),
      ('jlwm_world_states','active_threats','jsonb'),
      ('jlwm_world_states','opportunities','jsonb'),
      ('jlwm_world_states','state_summary','text'),
      ('jlwm_world_states','computed_at','timestamptz'),
      ('jlwm_world_states','valid_until','timestamptz'),
      ('jlwm_world_states','triggered_by','text'),
      -- legal_patterns
      ('jlwm_legal_patterns','id','text'),
      ('jlwm_legal_patterns','office_id','text'),
      ('jlwm_legal_patterns','pattern_type','text'),
      ('jlwm_legal_patterns','pattern_name','text'),
      ('jlwm_legal_patterns','description','text'),
      ('jlwm_legal_patterns','evidence_count','int4'),
      ('jlwm_legal_patterns','confidence_score','float8'),
      ('jlwm_legal_patterns','applies_to','jsonb'),
      ('jlwm_legal_patterns','is_active','bool'),
      ('jlwm_legal_patterns','first_seen_at','timestamptz'),
      ('jlwm_legal_patterns','last_seen_at','timestamptz'),
      -- command_sessions
      ('jlwm_command_sessions','id','text'),
      ('jlwm_command_sessions','office_id','text'),
      ('jlwm_command_sessions','user_id','text'),
      ('jlwm_command_sessions','query','text'),
      ('jlwm_command_sessions','response','text'),
      ('jlwm_command_sessions','context_used','jsonb'),
      ('jlwm_command_sessions','model_used','text'),
      ('jlwm_command_sessions','tokens_est','int4'),
      ('jlwm_command_sessions','duration_ms','int4'),
      ('jlwm_command_sessions','status','text'),
      ('jlwm_command_sessions','created_at','timestamptz'),
      -- command_actions
      ('jlwm_command_actions','id','text'),
      ('jlwm_command_actions','office_id','text'),
      ('jlwm_command_actions','user_id','text'),
      ('jlwm_command_actions','action_type','text'),
      ('jlwm_command_actions','status','text'),
      ('jlwm_command_actions','result','jsonb'),
      ('jlwm_command_actions','error_msg','text'),
      ('jlwm_command_actions','started_at','timestamptz'),
      ('jlwm_command_actions','finished_at','timestamptz'),
      -- case_twins
      ('jlwm_case_twins','id','text'),
      ('jlwm_case_twins','office_id','text'),
      ('jlwm_case_twins','case_id','text'),
      ('jlwm_case_twins','health_score','float8'),
      ('jlwm_case_twins','complexity_score','float8'),
      ('jlwm_case_twins','risk_level','text'),
      ('jlwm_case_twins','predicted_outcome','text'),
      ('jlwm_case_twins','outcome_confidence','float8'),
      ('jlwm_case_twins','predicted_duration_days','int4'),
      ('jlwm_case_twins','financial_exposure','float8'),
      ('jlwm_case_twins','key_entities','jsonb'),
      ('jlwm_case_twins','critical_dates','jsonb'),
      ('jlwm_case_twins','strengths','_text'),
      ('jlwm_case_twins','weaknesses','_text'),
      ('jlwm_case_twins','opportunities','_text'),
      ('jlwm_case_twins','state_data','jsonb'),
      ('jlwm_case_twins','last_synced_at','timestamptz'),
      ('jlwm_case_twins','created_at','timestamptz'),
      ('jlwm_case_twins','updated_at','timestamptz'),
      -- client_twins
      ('jlwm_client_twins','id','text'),
      ('jlwm_client_twins','office_id','text'),
      ('jlwm_client_twins','client_id','text'),
      ('jlwm_client_twins','loyalty_score','float8'),
      ('jlwm_client_twins','risk_score','float8'),
      ('jlwm_client_twins','ltv_score','float8'),
      ('jlwm_client_twins','total_cases','int4'),
      ('jlwm_client_twins','won_cases','int4'),
      ('jlwm_client_twins','lost_cases','int4'),
      ('jlwm_client_twins','active_cases','int4'),
      ('jlwm_client_twins','total_invoiced','float8'),
      ('jlwm_client_twins','total_paid','float8'),
      ('jlwm_client_twins','payment_reliability','float8'),
      ('jlwm_client_twins','churn_risk','text'),
      ('jlwm_client_twins','predicted_next_case','timestamptz'),
      ('jlwm_client_twins','behavioral_patterns','jsonb'),
      ('jlwm_client_twins','last_synced_at','timestamptz'),
      ('jlwm_client_twins','created_at','timestamptz'),
      ('jlwm_client_twins','updated_at','timestamptz'),
      -- firm_twin
      ('jlwm_firm_twin','id','text'),
      ('jlwm_firm_twin','office_id','text'),
      ('jlwm_firm_twin','performance_score','float8'),
      ('jlwm_firm_twin','efficiency_score','float8'),
      ('jlwm_firm_twin','health_score','float8'),
      ('jlwm_firm_twin','monthly_revenue','float8'),
      ('jlwm_firm_twin','revenue_trend','float8'),
      ('jlwm_firm_twin','active_cases_count','int4'),
      ('jlwm_firm_twin','avg_case_duration_days','float8'),
      ('jlwm_firm_twin','win_rate_pct','float8'),
      ('jlwm_firm_twin','client_satisfaction','float8'),
      ('jlwm_firm_twin','top_case_types','jsonb'),
      ('jlwm_firm_twin','resource_utilization','jsonb'),
      ('jlwm_firm_twin','financial_health','jsonb'),
      ('jlwm_firm_twin','growth_indicators','jsonb'),
      ('jlwm_firm_twin','snapshot_date','date'),
      ('jlwm_firm_twin','created_at','timestamptz'),
      ('jlwm_firm_twin','updated_at','timestamptz'),
      -- predictions
      ('jlwm_predictions','id','text'),
      ('jlwm_predictions','office_id','text'),
      ('jlwm_predictions','subject_type','text'),
      ('jlwm_predictions','subject_id','text'),
      ('jlwm_predictions','prediction_type','text'),
      ('jlwm_predictions','predicted_value','text'),
      ('jlwm_predictions','confidence_score','float8'),
      ('jlwm_predictions','supporting_data','jsonb'),
      ('jlwm_predictions','model_used','text'),
      ('jlwm_predictions','is_verified','bool'),
      ('jlwm_predictions','actual_value','text'),
      ('jlwm_predictions','expires_at','timestamptz'),
      ('jlwm_predictions','created_at','timestamptz'),
      ('jlwm_predictions','updated_at','timestamptz'),
      -- recommendations
      ('jlwm_recommendations','id','text'),
      ('jlwm_recommendations','office_id','text'),
      ('jlwm_recommendations','target_type','text'),
      ('jlwm_recommendations','target_id','text'),
      ('jlwm_recommendations','category','text'),
      ('jlwm_recommendations','priority','text'),
      ('jlwm_recommendations','title','text'),
      ('jlwm_recommendations','body','text'),
      ('jlwm_recommendations','action_items','jsonb'),
      ('jlwm_recommendations','estimated_impact','text'),
      ('jlwm_recommendations','is_read','bool'),
      ('jlwm_recommendations','is_applied','bool'),
      ('jlwm_recommendations','dismissed','bool'),
      ('jlwm_recommendations','expires_at','timestamptz'),
      ('jlwm_recommendations','created_at','timestamptz'),
      ('jlwm_recommendations','updated_at','timestamptz'),
      -- radar_alerts
      ('jlwm_radar_alerts','id','text'),
      ('jlwm_radar_alerts','office_id','text'),
      ('jlwm_radar_alerts','alert_type','text'),
      ('jlwm_radar_alerts','severity','text'),
      ('jlwm_radar_alerts','subject_type','text'),
      ('jlwm_radar_alerts','subject_id','text'),
      ('jlwm_radar_alerts','title','text'),
      ('jlwm_radar_alerts','body','text'),
      ('jlwm_radar_alerts','action_url','text'),
      ('jlwm_radar_alerts','is_acknowledged','bool'),
      ('jlwm_radar_alerts','acknowledged_by','text'),
      ('jlwm_radar_alerts','acknowledged_at','timestamptz'),
      ('jlwm_radar_alerts','auto_resolved','bool'),
      ('jlwm_radar_alerts','resolved_at','timestamptz'),
      ('jlwm_radar_alerts','created_at','timestamptz'),
      ('jlwm_radar_alerts','updated_at','timestamptz'),
      -- feedback
      ('jlwm_feedback','id','text'),
      ('jlwm_feedback','office_id','text'),
      ('jlwm_feedback','user_id','text'),
      ('jlwm_feedback','source_type','text'),
      ('jlwm_feedback','source_id','text'),
      ('jlwm_feedback','rating','int4'),
      ('jlwm_feedback','was_accurate','bool'),
      ('jlwm_feedback','was_useful','bool'),
      ('jlwm_feedback','user_action','text'),
      ('jlwm_feedback','notes','text'),
      ('jlwm_feedback','created_at','timestamptz'),
      ('jlwm_feedback','updated_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;

    IF actual_udt IS NULL THEN
      RAISE EXCEPTION
        '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% missing after ADD COLUMN',
        spec.table_name, spec.column_name;
    END IF;
    IF actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, actual_udt, spec.udt_name;
    END IF;
  END LOOP;

  /* NULL office_id + non-UUID ownership (no invent/remap/delete) */
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_config','jlwm_memory_nodes','jlwm_memory_edges','jlwm_world_states',
    'jlwm_legal_patterns','jlwm_command_sessions','jlwm_command_actions',
    'jlwm_case_twins','jlwm_client_twins','jlwm_firm_twin','jlwm_predictions',
    'jlwm_recommendations','jlwm_radar_alerts','jlwm_feedback'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE office_id IS NULL', tbl) INTO null_cnt;
    IF null_cnt > 0 THEN
      RAISE EXCEPTION
        '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_OFFICE_ID) — % row(s) with NULL office_id on %; no invent/remap',
        null_cnt, tbl;
    END IF;

    EXECUTE format(
      $q$SELECT COUNT(*) FROM %I WHERE office_id IS NOT NULL AND office_id !~ %L$q$,
      tbl, uuid_re
    ) INTO non_uuid_cnt;
    IF non_uuid_cnt > 0 THEN
      RAISE EXCEPTION
        '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NON_UUID_OFFICE_ID) — % non-UUID office_id row(s) on %; no invent/remap/delete',
        non_uuid_cnt, tbl;
    END IF;
  END LOOP;

  /* Duplicate UNIQUE arbiters */
  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id FROM jlwm_config GROUP BY office_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_CONFIG_OFFICE_ID) — % duplicate office_id group(s) on jlwm_config',
      dup_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id, case_id FROM jlwm_case_twins GROUP BY office_id, case_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_CASE_TWIN) — % duplicate (office_id,case_id) group(s)',
      dup_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id, client_id FROM jlwm_client_twins GROUP BY office_id, client_id HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_CLIENT_TWIN) — % duplicate (office_id,client_id) group(s)',
      dup_cnt;
  END IF;

  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id, snapshot_date FROM jlwm_firm_twin GROUP BY office_id, snapshot_date HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_FIRM_TWIN) — % duplicate (office_id,snapshot_date) group(s)',
      dup_cnt;
  END IF;

  /* Partial unique key duplicates for memory nodes (node_ref IS NOT NULL) */
  SELECT COUNT(*) INTO dup_cnt FROM (
    SELECT office_id, node_type, node_ref
    FROM jlwm_memory_nodes
    WHERE node_ref IS NOT NULL
    GROUP BY office_id, node_type, node_ref
    HAVING COUNT(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION
      '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_MEMORY_NODE) — % duplicate (office_id,node_type,node_ref) group(s) where node_ref IS NOT NULL',
      dup_cnt;
  END IF;
END $$;

-- Safe defaults (values unchanged)
ALTER TABLE jlwm_config ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_config ALTER COLUMN enabled SET DEFAULT TRUE;
ALTER TABLE jlwm_config ALTER COLUMN enabled_modules SET DEFAULT ARRAY['memory_graph','world_state','command_center'];
ALTER TABLE jlwm_config ALTER COLUMN sync_frequency SET DEFAULT 'hourly';
ALTER TABLE jlwm_config ALTER COLUMN ai_model SET DEFAULT 'gemini';
ALTER TABLE jlwm_config ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_config ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE jlwm_memory_nodes ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_memory_nodes ALTER COLUMN properties SET DEFAULT '{}';
ALTER TABLE jlwm_memory_nodes ALTER COLUMN importance_score SET DEFAULT 0.5;
ALTER TABLE jlwm_memory_nodes ALTER COLUMN is_auto SET DEFAULT TRUE;
ALTER TABLE jlwm_memory_nodes ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_memory_nodes ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE jlwm_memory_edges ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_memory_edges ALTER COLUMN weight SET DEFAULT 0.5;
ALTER TABLE jlwm_memory_edges ALTER COLUMN evidence SET DEFAULT '{}';
ALTER TABLE jlwm_memory_edges ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE jlwm_world_states ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_world_states ALTER COLUMN risk_level SET DEFAULT 'green';
ALTER TABLE jlwm_world_states ALTER COLUMN state_vector SET DEFAULT '{}';
ALTER TABLE jlwm_world_states ALTER COLUMN active_threats SET DEFAULT '[]';
ALTER TABLE jlwm_world_states ALTER COLUMN opportunities SET DEFAULT '[]';
ALTER TABLE jlwm_world_states ALTER COLUMN computed_at SET DEFAULT NOW();
ALTER TABLE jlwm_world_states ALTER COLUMN valid_until SET DEFAULT (NOW() + INTERVAL '1 hour');
ALTER TABLE jlwm_world_states ALTER COLUMN triggered_by SET DEFAULT 'auto';

ALTER TABLE jlwm_legal_patterns ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_legal_patterns ALTER COLUMN evidence_count SET DEFAULT 1;
ALTER TABLE jlwm_legal_patterns ALTER COLUMN confidence_score SET DEFAULT 0.5;
ALTER TABLE jlwm_legal_patterns ALTER COLUMN applies_to SET DEFAULT '{}';
ALTER TABLE jlwm_legal_patterns ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE jlwm_legal_patterns ALTER COLUMN first_seen_at SET DEFAULT NOW();
ALTER TABLE jlwm_legal_patterns ALTER COLUMN last_seen_at SET DEFAULT NOW();

ALTER TABLE jlwm_command_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_command_sessions ALTER COLUMN context_used SET DEFAULT '{}';
ALTER TABLE jlwm_command_sessions ALTER COLUMN tokens_est SET DEFAULT 0;
ALTER TABLE jlwm_command_sessions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE jlwm_command_sessions ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE jlwm_command_actions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_command_actions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE jlwm_command_actions ALTER COLUMN result SET DEFAULT '{}';
ALTER TABLE jlwm_command_actions ALTER COLUMN started_at SET DEFAULT NOW();

ALTER TABLE jlwm_case_twins ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_case_twins ALTER COLUMN health_score SET DEFAULT 50;
ALTER TABLE jlwm_case_twins ALTER COLUMN complexity_score SET DEFAULT 50;
ALTER TABLE jlwm_case_twins ALTER COLUMN risk_level SET DEFAULT 'medium';
ALTER TABLE jlwm_case_twins ALTER COLUMN outcome_confidence SET DEFAULT 0;
ALTER TABLE jlwm_case_twins ALTER COLUMN financial_exposure SET DEFAULT 0;
ALTER TABLE jlwm_case_twins ALTER COLUMN key_entities SET DEFAULT '[]';
ALTER TABLE jlwm_case_twins ALTER COLUMN critical_dates SET DEFAULT '[]';
ALTER TABLE jlwm_case_twins ALTER COLUMN strengths SET DEFAULT ARRAY[]::text[];
ALTER TABLE jlwm_case_twins ALTER COLUMN weaknesses SET DEFAULT ARRAY[]::text[];
ALTER TABLE jlwm_case_twins ALTER COLUMN opportunities SET DEFAULT ARRAY[]::text[];
ALTER TABLE jlwm_case_twins ALTER COLUMN state_data SET DEFAULT '{}';
ALTER TABLE jlwm_case_twins ALTER COLUMN last_synced_at SET DEFAULT NOW();
ALTER TABLE jlwm_case_twins ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_case_twins ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE jlwm_client_twins ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_client_twins ALTER COLUMN loyalty_score SET DEFAULT 50;
ALTER TABLE jlwm_client_twins ALTER COLUMN risk_score SET DEFAULT 50;
ALTER TABLE jlwm_client_twins ALTER COLUMN ltv_score SET DEFAULT 0;
ALTER TABLE jlwm_client_twins ALTER COLUMN total_cases SET DEFAULT 0;
ALTER TABLE jlwm_client_twins ALTER COLUMN won_cases SET DEFAULT 0;
ALTER TABLE jlwm_client_twins ALTER COLUMN lost_cases SET DEFAULT 0;
ALTER TABLE jlwm_client_twins ALTER COLUMN active_cases SET DEFAULT 0;
ALTER TABLE jlwm_client_twins ALTER COLUMN total_invoiced SET DEFAULT 0;
ALTER TABLE jlwm_client_twins ALTER COLUMN total_paid SET DEFAULT 0;
ALTER TABLE jlwm_client_twins ALTER COLUMN payment_reliability SET DEFAULT 1;
ALTER TABLE jlwm_client_twins ALTER COLUMN churn_risk SET DEFAULT 'low';
ALTER TABLE jlwm_client_twins ALTER COLUMN behavioral_patterns SET DEFAULT '{}';
ALTER TABLE jlwm_client_twins ALTER COLUMN last_synced_at SET DEFAULT NOW();
ALTER TABLE jlwm_client_twins ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_client_twins ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE jlwm_firm_twin ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_firm_twin ALTER COLUMN performance_score SET DEFAULT 50;
ALTER TABLE jlwm_firm_twin ALTER COLUMN efficiency_score SET DEFAULT 50;
ALTER TABLE jlwm_firm_twin ALTER COLUMN health_score SET DEFAULT 50;
ALTER TABLE jlwm_firm_twin ALTER COLUMN monthly_revenue SET DEFAULT 0;
ALTER TABLE jlwm_firm_twin ALTER COLUMN revenue_trend SET DEFAULT 0;
ALTER TABLE jlwm_firm_twin ALTER COLUMN active_cases_count SET DEFAULT 0;
ALTER TABLE jlwm_firm_twin ALTER COLUMN avg_case_duration_days SET DEFAULT 0;
ALTER TABLE jlwm_firm_twin ALTER COLUMN win_rate_pct SET DEFAULT 0;
ALTER TABLE jlwm_firm_twin ALTER COLUMN client_satisfaction SET DEFAULT 50;
ALTER TABLE jlwm_firm_twin ALTER COLUMN top_case_types SET DEFAULT '[]';
ALTER TABLE jlwm_firm_twin ALTER COLUMN resource_utilization SET DEFAULT '{}';
ALTER TABLE jlwm_firm_twin ALTER COLUMN financial_health SET DEFAULT '{}';
ALTER TABLE jlwm_firm_twin ALTER COLUMN growth_indicators SET DEFAULT '{}';
ALTER TABLE jlwm_firm_twin ALTER COLUMN snapshot_date SET DEFAULT CURRENT_DATE;
ALTER TABLE jlwm_firm_twin ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_firm_twin ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE jlwm_predictions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_predictions ALTER COLUMN confidence_score SET DEFAULT 0;
ALTER TABLE jlwm_predictions ALTER COLUMN supporting_data SET DEFAULT '{}';
ALTER TABLE jlwm_predictions ALTER COLUMN is_verified SET DEFAULT FALSE;
ALTER TABLE jlwm_predictions ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_predictions ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE jlwm_recommendations ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_recommendations ALTER COLUMN target_type SET DEFAULT 'firm';
ALTER TABLE jlwm_recommendations ALTER COLUMN priority SET DEFAULT 'medium';
ALTER TABLE jlwm_recommendations ALTER COLUMN action_items SET DEFAULT '[]';
ALTER TABLE jlwm_recommendations ALTER COLUMN is_read SET DEFAULT FALSE;
ALTER TABLE jlwm_recommendations ALTER COLUMN is_applied SET DEFAULT FALSE;
ALTER TABLE jlwm_recommendations ALTER COLUMN dismissed SET DEFAULT FALSE;
ALTER TABLE jlwm_recommendations ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_recommendations ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE jlwm_radar_alerts ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_radar_alerts ALTER COLUMN severity SET DEFAULT 'warning';
ALTER TABLE jlwm_radar_alerts ALTER COLUMN is_acknowledged SET DEFAULT FALSE;
ALTER TABLE jlwm_radar_alerts ALTER COLUMN auto_resolved SET DEFAULT FALSE;
ALTER TABLE jlwm_radar_alerts ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_radar_alerts ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE jlwm_feedback ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE jlwm_feedback ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE jlwm_feedback ALTER COLUMN updated_at SET DEFAULT NOW();

-- Safe SET NOT NULL on required columns (NULLs already blocked for office_id;
-- other required columns: BLOCK if NULL rows exist)
DO $$
DECLARE
  null_cnt BIGINT;
BEGIN
  SELECT COUNT(*) INTO null_cnt FROM jlwm_config WHERE id IS NULL OR office_id IS NULL OR enabled IS NULL
    OR enabled_modules IS NULL OR sync_frequency IS NULL OR ai_model IS NULL
    OR created_at IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_config has % row(s) with NULL required columns', null_cnt;
  END IF;
  ALTER TABLE jlwm_config ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_config ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_config ALTER COLUMN enabled SET NOT NULL;
  ALTER TABLE jlwm_config ALTER COLUMN enabled_modules SET NOT NULL;
  ALTER TABLE jlwm_config ALTER COLUMN sync_frequency SET NOT NULL;
  ALTER TABLE jlwm_config ALTER COLUMN ai_model SET NOT NULL;
  ALTER TABLE jlwm_config ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE jlwm_config ALTER COLUMN updated_at SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_memory_nodes
  WHERE id IS NULL OR office_id IS NULL OR node_type IS NULL OR label IS NULL
    OR properties IS NULL OR importance_score IS NULL OR is_auto IS NULL
    OR created_at IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_memory_nodes has % incompatible NULL row(s)', null_cnt;
  END IF;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN node_type SET NOT NULL;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN label SET NOT NULL;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN properties SET NOT NULL;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN importance_score SET NOT NULL;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN is_auto SET NOT NULL;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE jlwm_memory_nodes ALTER COLUMN updated_at SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_memory_edges
  WHERE id IS NULL OR office_id IS NULL OR from_node_id IS NULL OR to_node_id IS NULL
    OR edge_type IS NULL OR weight IS NULL OR evidence IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_memory_edges has % incompatible NULL row(s)', null_cnt;
  END IF;
  ALTER TABLE jlwm_memory_edges ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_memory_edges ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_memory_edges ALTER COLUMN from_node_id SET NOT NULL;
  ALTER TABLE jlwm_memory_edges ALTER COLUMN to_node_id SET NOT NULL;
  ALTER TABLE jlwm_memory_edges ALTER COLUMN edge_type SET NOT NULL;
  ALTER TABLE jlwm_memory_edges ALTER COLUMN weight SET NOT NULL;
  ALTER TABLE jlwm_memory_edges ALTER COLUMN evidence SET NOT NULL;
  ALTER TABLE jlwm_memory_edges ALTER COLUMN created_at SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_case_twins
  WHERE id IS NULL OR office_id IS NULL OR case_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_case_twins has % NULL required identifier row(s)', null_cnt;
  END IF;
  ALTER TABLE jlwm_case_twins ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_case_twins ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_case_twins ALTER COLUMN case_id SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_client_twins
  WHERE id IS NULL OR office_id IS NULL OR client_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_client_twins has % NULL required identifier row(s)', null_cnt;
  END IF;
  ALTER TABLE jlwm_client_twins ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_client_twins ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_client_twins ALTER COLUMN client_id SET NOT NULL;

  SELECT COUNT(*) INTO null_cnt FROM jlwm_firm_twin
  WHERE id IS NULL OR office_id IS NULL OR snapshot_date IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — jlwm_firm_twin has % NULL required identifier row(s)', null_cnt;
  END IF;
  ALTER TABLE jlwm_firm_twin ALTER COLUMN id SET NOT NULL;
  ALTER TABLE jlwm_firm_twin ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_firm_twin ALTER COLUMN snapshot_date SET NOT NULL;

  /* Remaining tables: office_id NOT NULL (already checked); set other Runtime NOT NULLs when safe */
  ALTER TABLE jlwm_world_states ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_legal_patterns ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_command_sessions ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_command_actions ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_predictions ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_recommendations ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_radar_alerts ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE jlwm_feedback ALTER COLUMN office_id SET NOT NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PK / UNIQUE arbiters
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  has_pk BOOLEAN;
  has_unique BOOLEAN;
  wrong_unique BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_config','jlwm_memory_nodes','jlwm_memory_edges','jlwm_world_states',
    'jlwm_legal_patterns','jlwm_command_sessions','jlwm_command_actions',
    'jlwm_case_twins','jlwm_client_twins','jlwm_firm_twin','jlwm_predictions',
    'jlwm_recommendations','jlwm_radar_alerts','jlwm_feedback'
  ]
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
    ) INTO has_pk;

    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION
          '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED_IDENTIFIERS) — NULL id blocks PK on %',
          tbl;
      END IF;
      EXECUTE format(
        'SELECT COUNT(*) FROM (SELECT id FROM %I GROUP BY id HAVING COUNT(*) > 1) d',
        tbl
      ) INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_PK) — duplicate id on %',
          tbl;
      END IF;
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = format('public.%I', tbl)::regclass AND c.contype = 'p'
          AND pg_get_constraintdef(c.oid) ~* '\(id\)'
          AND pg_get_constraintdef(c.oid) !~* ','
      ) THEN
        RAISE EXCEPTION
          '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)',
          tbl;
      END IF;
    END IF;
  END LOOP;

  /* jlwm_config UNIQUE(office_id) */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_config'::regclass
      AND c.contype IN ('u','p')
      AND pg_get_constraintdef(c.oid) ~* '\(office_id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.jlwm_config'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indnkeyatts = 1
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
          AND NOT a.attisdropped AND a.attname = 'office_id'
      )
  ) INTO has_unique;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_config'::regclass
      AND c.contype = 'u'
      AND c.conname = 'jlwm_config_office_id_key'
      AND (
        pg_get_constraintdef(c.oid) !~* '\(office_id\)'
        OR pg_get_constraintdef(c.oid) ~* ','
      )
  ) INTO wrong_unique;
  IF wrong_unique THEN
    RAISE EXCEPTION
      '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — jlwm_config_office_id_key wrong shape';
  END IF;

  IF NOT has_unique THEN
    ALTER TABLE jlwm_config ADD CONSTRAINT jlwm_config_office_id_key UNIQUE (office_id);
  END IF;

  /* case_twins UNIQUE(office_id, case_id) */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_case_twins'::regclass
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*case_id\)'
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.jlwm_case_twins'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (
        SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
      ) = ARRAY['office_id','case_id']::text[]
  ) INTO has_unique;
  IF NOT has_unique THEN
    ALTER TABLE jlwm_case_twins ADD CONSTRAINT jlwm_case_twins_office_id_case_id_key UNIQUE (office_id, case_id);
  END IF;

  /* client_twins UNIQUE(office_id, client_id) */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_client_twins'::regclass
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*client_id\)'
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.jlwm_client_twins'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (
        SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
      ) = ARRAY['office_id','client_id']::text[]
  ) INTO has_unique;
  IF NOT has_unique THEN
    ALTER TABLE jlwm_client_twins ADD CONSTRAINT jlwm_client_twins_office_id_client_id_key UNIQUE (office_id, client_id);
  END IF;

  /* firm_twin UNIQUE(office_id, snapshot_date) */
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_firm_twin'::regclass
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*snapshot_date\)'
  ) OR EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid = 'public.jlwm_firm_twin'::regclass
      AND x.indisunique AND x.indisvalid AND x.indisready
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND (
        SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped
      ) = ARRAY['office_id','snapshot_date']::text[]
  ) INTO has_unique;
  IF NOT has_unique THEN
    ALTER TABLE jlwm_firm_twin ADD CONSTRAINT jlwm_firm_twin_office_id_snapshot_date_key UNIQUE (office_id, snapshot_date);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes (non-unique) + partial UNIQUE idx_jmn_uniq
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  expected_table_oid OID;
  actual_table_oid OID;
  index_unique BOOLEAN;
  index_partial BOOLEAN;
  index_expression BOOLEAN;
  index_valid BOOLEAN;
  index_ready BOOLEAN;
  index_columns TEXT[];
  pred_sql TEXT;
  pred_norm TEXT;
BEGIN
  /* Non-unique indexes */
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_jmn_office', 'jlwm_memory_nodes', ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jmn_office ON jlwm_memory_nodes(office_id)'),
      ('idx_jmn_type', 'jlwm_memory_nodes', ARRAY['office_id','node_type']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jmn_type ON jlwm_memory_nodes(office_id, node_type)'),
      ('idx_jmn_ref', 'jlwm_memory_nodes', ARRAY['office_id','node_ref']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jmn_ref ON jlwm_memory_nodes(office_id, node_ref)'),
      ('idx_jme_office', 'jlwm_memory_edges', ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jme_office ON jlwm_memory_edges(office_id)'),
      ('idx_jme_from', 'jlwm_memory_edges', ARRAY['from_node_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jme_from ON jlwm_memory_edges(from_node_id)'),
      ('idx_jme_to', 'jlwm_memory_edges', ARRAY['to_node_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jme_to ON jlwm_memory_edges(to_node_id)'),
      ('idx_jws_office_time', 'jlwm_world_states', ARRAY['office_id','computed_at']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jws_office_time ON jlwm_world_states(office_id, computed_at DESC)'),
      ('idx_jlp_office', 'jlwm_legal_patterns', ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jlp_office ON jlwm_legal_patterns(office_id)'),
      ('idx_jcs_office_time', 'jlwm_command_sessions', ARRAY['office_id','created_at']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jcs_office_time ON jlwm_command_sessions(office_id, created_at DESC)'),
      ('idx_jca_office_time', 'jlwm_command_actions', ARRAY['office_id','started_at']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jca_office_time ON jlwm_command_actions(office_id, started_at DESC)'),
      ('idx_jct_office', 'jlwm_case_twins', ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jct_office ON jlwm_case_twins(office_id)'),
      ('idx_jct_case', 'jlwm_case_twins', ARRAY['case_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jct_case ON jlwm_case_twins(case_id)'),
      ('idx_jct_risk', 'jlwm_case_twins', ARRAY['office_id','risk_level']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jct_risk ON jlwm_case_twins(office_id, risk_level)'),
      ('idx_jclt_office', 'jlwm_client_twins', ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jclt_office ON jlwm_client_twins(office_id)'),
      ('idx_jclt_client', 'jlwm_client_twins', ARRAY['client_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jclt_client ON jlwm_client_twins(client_id)'),
      ('idx_jclt_churn', 'jlwm_client_twins', ARRAY['office_id','churn_risk']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jclt_churn ON jlwm_client_twins(office_id, churn_risk)'),
      ('idx_jft_office', 'jlwm_firm_twin', ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jft_office ON jlwm_firm_twin(office_id)'),
      ('idx_jpred_office', 'jlwm_predictions', ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jpred_office ON jlwm_predictions(office_id)'),
      ('idx_jpred_type', 'jlwm_predictions', ARRAY['office_id','prediction_type']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jpred_type ON jlwm_predictions(office_id, prediction_type)'),
      ('idx_jpred_subject', 'jlwm_predictions', ARRAY['subject_type','subject_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jpred_subject ON jlwm_predictions(subject_type, subject_id)'),
      ('idx_jrec_office_pri', 'jlwm_recommendations', ARRAY['office_id','priority']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jrec_office_pri ON jlwm_recommendations(office_id, priority)'),
      ('idx_jra_office_sev', 'jlwm_radar_alerts', ARRAY['office_id','severity']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jra_office_sev ON jlwm_radar_alerts(office_id, severity)'),
      ('idx_jfb_office', 'jlwm_feedback', ARRAY['office_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jfb_office ON jlwm_feedback(office_id)'),
      ('idx_jfb_source', 'jlwm_feedback', ARRAY['source_type','source_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_jfb_source ON jlwm_feedback(source_type, source_id)')
    ) AS t(index_name, table_name, columns, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    actual_table_oid := NULL;
    index_unique := NULL;
    index_partial := NULL;
    index_expression := NULL;
    index_valid := NULL;
    index_ready := NULL;
    index_columns := NULL;

    SELECT
      x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (
        SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS key_column(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid AND a.attnum = key_column.attnum AND NOT a.attisdropped
      )
    INTO actual_table_oid, index_unique, index_partial, index_expression,
         index_valid, index_ready, index_columns
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    WHERE n.nspname = 'public' AND i.relname = spec.index_name;

    IF NOT FOUND THEN
      EXECUTE spec.create_sql;
    ELSIF actual_table_oid IS DISTINCT FROM expected_table_oid
       OR index_unique IS TRUE
       OR index_partial IS TRUE
       OR index_expression IS TRUE
       OR index_valid IS NOT TRUE
       OR index_ready IS NOT TRUE
       OR index_columns IS DISTINCT FROM spec.columns THEN
      RAISE EXCEPTION
        '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (table=% unique=% partial=% expression=% valid=% ready=% columns=% expected=%)',
        spec.index_name, actual_table_oid::regclass, index_unique, index_partial,
        index_expression, index_valid, index_ready, index_columns, spec.columns;
    END IF;
  END LOOP;

  /* Partial UNIQUE idx_jmn_uniq — exact Runtime shape */
  SELECT
    x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
    x.indisvalid, x.indisready, pg_get_expr(x.indpred, x.indrelid),
    (
      SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
      FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS key_column(attnum, ordinality)
      LEFT JOIN pg_attribute a
        ON a.attrelid = x.indrelid AND a.attnum = key_column.attnum AND NOT a.attisdropped
    )
  INTO actual_table_oid, index_unique, index_partial, index_expression,
       index_valid, index_ready, pred_sql, index_columns
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  LEFT JOIN pg_index x ON x.indexrelid = i.oid
  WHERE n.nspname = 'public' AND i.relname = 'idx_jmn_uniq';

  IF NOT FOUND THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_jmn_uniq
      ON jlwm_memory_nodes(office_id, node_type, node_ref)
      WHERE node_ref IS NOT NULL;
  ELSE
    pred_norm := lower(regexp_replace(COALESCE(pred_sql, ''), '\s+', '', 'g'));
    IF actual_table_oid IS DISTINCT FROM 'public.jlwm_memory_nodes'::regclass
       OR index_unique IS NOT TRUE
       OR index_partial IS NOT TRUE
       OR index_expression IS TRUE
       OR index_valid IS NOT TRUE
       OR index_ready IS NOT TRUE
       OR index_columns IS DISTINCT FROM ARRAY['office_id','node_type','node_ref']::text[]
       OR pred_norm IS DISTINCT FROM '(node_refisnotnull)' THEN
      RAISE EXCEPTION
        '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — idx_jmn_uniq incompatible (unique=% partial=% expression=% valid=% ready=% columns=% pred=%); expected UNIQUE (office_id,node_type,node_ref) WHERE node_ref IS NOT NULL',
        index_unique, index_partial, index_expression, index_valid, index_ready,
        index_columns, pred_sql;
    END IF;
  END IF;

  /* Partial non-unique indexes with predicates (unread / unack) */
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_jrec_unread', 'jlwm_recommendations', ARRAY['office_id','is_read']::text[],
       '(is_read = false)',
       'CREATE INDEX IF NOT EXISTS idx_jrec_unread ON jlwm_recommendations(office_id, is_read) WHERE is_read = FALSE'),
      ('idx_jra_unack', 'jlwm_radar_alerts', ARRAY['office_id','is_acknowledged']::text[],
       '(is_acknowledged = false)',
       'CREATE INDEX IF NOT EXISTS idx_jra_unack ON jlwm_radar_alerts(office_id, is_acknowledged) WHERE is_acknowledged = FALSE')
    ) AS t(index_name, table_name, columns, expected_pred_norm, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    SELECT
      x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready, pg_get_expr(x.indpred, x.indrelid),
      (
        SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS key_column(attnum, ordinality)
        LEFT JOIN pg_attribute a
          ON a.attrelid = x.indrelid AND a.attnum = key_column.attnum AND NOT a.attisdropped
      )
    INTO actual_table_oid, index_unique, index_partial, index_expression,
         index_valid, index_ready, pred_sql, index_columns
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid = i.oid
    WHERE n.nspname = 'public' AND i.relname = spec.index_name;

    IF NOT FOUND THEN
      EXECUTE spec.create_sql;
    ELSE
      pred_norm := lower(regexp_replace(COALESCE(pred_sql, ''), '\s+', '', 'g'));
      /* PG may store "= false" as NOT col */
      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS TRUE
         OR index_partial IS NOT TRUE
         OR index_expression IS TRUE
         OR index_valid IS NOT TRUE
         OR index_ready IS NOT TRUE
         OR index_columns IS DISTINCT FROM spec.columns
         OR (
           CASE
             WHEN spec.index_name = 'idx_jrec_unread' THEN
               pred_norm NOT IN ('(is_read=false)', '(notis_read)')
             WHEN spec.index_name = 'idx_jra_unack' THEN
               pred_norm NOT IN ('(is_acknowledged=false)', '(notis_acknowledged)')
             ELSE
               pred_norm IS DISTINCT FROM lower(regexp_replace(spec.expected_pred_norm, '\s+', '', 'g'))
           END
         ) THEN
        RAISE EXCEPTION
          '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible partial index (pred=%)',
          spec.index_name, pred_sql;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Memory edges FK → nodes ON DELETE CASCADE (legacy-safe defer on orphans)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  fk_from_installed BOOLEAN := false;
  fk_to_installed BOOLEAN := false;
  orphan_from BIGINT := 0;
  orphan_to BIGINT := 0;
  fk_deferred_reason TEXT := NULL;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_memory_edges'::regclass
      AND c.contype = 'f'
      AND c.conname = 'jlwm_memory_edges_from_node_id_fkey'
  ) INTO fk_from_installed;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_memory_edges'::regclass
      AND c.contype = 'f'
      AND c.conname = 'jlwm_memory_edges_to_node_id_fkey'
  ) INTO fk_to_installed;

  SELECT COUNT(*) INTO orphan_from
  FROM jlwm_memory_edges e
  WHERE e.from_node_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jlwm_memory_nodes n WHERE n.id = e.from_node_id);

  SELECT COUNT(*) INTO orphan_to
  FROM jlwm_memory_edges e
  WHERE e.to_node_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jlwm_memory_nodes n WHERE n.id = e.to_node_id);

  IF orphan_from > 0 OR orphan_to > 0 THEN
    fk_deferred_reason := format('orphan_from=%s orphan_to=%s', orphan_from, orphan_to);
    RAISE WARNING
      '034_jlwm_core: FK_DEFERRED_ORPHANS — skipping memory_edges FKs; %; no invent/delete/remap. FK not fully installed.',
      fk_deferred_reason;
  ELSE
    IF NOT fk_from_installed THEN
      BEGIN
        ALTER TABLE jlwm_memory_edges
          ADD CONSTRAINT jlwm_memory_edges_from_node_id_fkey          FOREIGN KEY (from_node_id)
          REFERENCES jlwm_memory_nodes(id)
          ON DELETE CASCADE;
        fk_from_installed := true;
      EXCEPTION
        WHEN duplicate_object THEN
          fk_from_installed := true;
        WHEN foreign_key_violation THEN
          fk_deferred_reason := 'foreign_key_violation_from';
          RAISE WARNING '034_jlwm_core: FK_DEFERRED_ORPHANS — from_node_id FK not installed';
        WHEN datatype_mismatch THEN
          RAISE EXCEPTION '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — from_node_id FK datatype_mismatch';
      END;
    END IF;

    IF NOT fk_to_installed AND fk_deferred_reason IS NULL THEN
      BEGIN
        ALTER TABLE jlwm_memory_edges
          ADD CONSTRAINT jlwm_memory_edges_to_node_id_fkey
          FOREIGN KEY (to_node_id)
          REFERENCES jlwm_memory_nodes(id)
          ON DELETE CASCADE;
        fk_to_installed := true;
      EXCEPTION
        WHEN duplicate_object THEN
          fk_to_installed := true;
        WHEN foreign_key_violation THEN
          fk_deferred_reason := 'foreign_key_violation_to';
          RAISE WARNING '034_jlwm_core: FK_DEFERRED_ORPHANS — to_node_id FK not installed';
        WHEN datatype_mismatch THEN
          RAISE EXCEPTION '034_jlwm_core: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — to_node_id FK datatype_mismatch';
      END;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_memory_edges'::regclass
      AND c.contype = 'f'
      AND c.conname = 'jlwm_memory_edges_from_node_id_fkey'
  ) INTO fk_from_installed;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_memory_edges'::regclass
      AND c.contype = 'f'
      AND c.conname = 'jlwm_memory_edges_to_node_id_fkey'
  ) INTO fk_to_installed;

  IF fk_from_installed AND fk_to_installed THEN
    RAISE NOTICE '034_jlwm_core: memory_edges FK status=INSTALLED (from+to ON DELETE CASCADE)';
  ELSIF fk_from_installed OR fk_to_installed THEN
    RAISE NOTICE '034_jlwm_core: memory_edges FK status=DEFERRED (partial from=% to=% reason=%); not claiming full FK readiness',
      fk_from_installed, fk_to_installed, COALESCE(fk_deferred_reason, 'unknown');
  ELSE
    RAISE NOTICE '034_jlwm_core: memory_edges FK status=DEFERRED (%); not claiming full FK readiness',
      COALESCE(fk_deferred_reason, 'pending');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness (must pass before COMMIT)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
  missing TEXT[] := ARRAY[]::text[];
  actual_udt TEXT;
  has_unique BOOLEAN;
  index_ok BOOLEAN;
  pred_sql TEXT;
  pred_norm TEXT;
  index_columns TEXT[];
  fk_from BOOLEAN;
  fk_to BOOLEAN;
  orphan_from BIGINT;
  orphan_to BIGINT;
  fk_status TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'jlwm_config','jlwm_memory_nodes','jlwm_memory_edges','jlwm_world_states',
    'jlwm_legal_patterns','jlwm_command_sessions','jlwm_command_actions',
    'jlwm_case_twins','jlwm_client_twins','jlwm_firm_twin','jlwm_predictions',
    'jlwm_recommendations','jlwm_radar_alerts','jlwm_feedback'
  ]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      missing := array_append(missing, tbl);
    END IF;
  END LOOP;
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      '034_jlwm_core: POST_APPLY_READINESS_FAILED — missing tables: %',
      array_to_string(missing, ', ');
  END IF;

  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_config' AND c.column_name='office_id';
  IF actual_udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION '034_jlwm_core: POST_APPLY_READINESS_FAILED — jlwm_config.office_id udt=%', actual_udt;
  END IF;

  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_memory_nodes' AND c.column_name='importance_score';
  IF actual_udt IS DISTINCT FROM 'float8' THEN
    RAISE EXCEPTION '034_jlwm_core: POST_APPLY_READINESS_FAILED — jlwm_memory_nodes.importance_score udt=%', actual_udt;
  END IF;

  SELECT c.udt_name INTO actual_udt FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='jlwm_firm_twin' AND c.column_name='snapshot_date';
  IF actual_udt IS DISTINCT FROM 'date' THEN
    RAISE EXCEPTION '034_jlwm_core: POST_APPLY_READINESS_FAILED — jlwm_firm_twin.snapshot_date udt=%', actual_udt;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_config'::regclass
      AND c.contype IN ('u','p')
      AND pg_get_constraintdef(c.oid) ~* '\(office_id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) INTO has_unique;
  IF NOT has_unique THEN
    RAISE EXCEPTION '034_jlwm_core: POST_APPLY_READINESS_FAILED — jlwm_config UNIQUE(office_id) missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_case_twins'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*case_id\)'
  ) INTO has_unique;
  IF NOT has_unique THEN
    RAISE EXCEPTION '034_jlwm_core: POST_APPLY_READINESS_FAILED — jlwm_case_twins UNIQUE(office_id,case_id) missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_client_twins'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*client_id\)'
  ) INTO has_unique;
  IF NOT has_unique THEN
    RAISE EXCEPTION '034_jlwm_core: POST_APPLY_READINESS_FAILED — jlwm_client_twins UNIQUE(office_id,client_id) missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_firm_twin'::regclass AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ~* '\(office_id,\s*snapshot_date\)'
  ) INTO has_unique;
  IF NOT has_unique THEN
    RAISE EXCEPTION '034_jlwm_core: POST_APPLY_READINESS_FAILED — jlwm_firm_twin UNIQUE(office_id,snapshot_date) missing';
  END IF;

  SELECT
    x.indisunique AND x.indpred IS NOT NULL AND x.indexprs IS NULL
      AND x.indisvalid AND x.indisready,
    pg_get_expr(x.indpred, x.indrelid),
    (
      SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
      FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS key_column(attnum, ordinality)
      LEFT JOIN pg_attribute a
        ON a.attrelid = x.indrelid AND a.attnum = key_column.attnum AND NOT a.attisdropped
    )
  INTO index_ok, pred_sql, index_columns
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  JOIN pg_index x ON x.indexrelid = i.oid
  WHERE n.nspname = 'public' AND i.relname = 'idx_jmn_uniq'
    AND x.indrelid = 'public.jlwm_memory_nodes'::regclass;

  pred_norm := lower(regexp_replace(COALESCE(pred_sql, ''), '\s+', '', 'g'));
  IF index_ok IS NOT TRUE
     OR index_columns IS DISTINCT FROM ARRAY['office_id','node_type','node_ref']::text[]
     OR pred_norm IS DISTINCT FROM '(node_refisnotnull)' THEN
    RAISE EXCEPTION
      '034_jlwm_core: POST_APPLY_READINESS_FAILED — idx_jmn_uniq not exact (ok=% cols=% pred=%)',
      index_ok, index_columns, pred_sql;
  END IF;

  IF to_regclass('public.idx_jmn_office') IS NULL
     OR to_regclass('public.idx_jme_office') IS NULL
     OR to_regclass('public.idx_jct_office') IS NULL
     OR to_regclass('public.idx_jclt_office') IS NULL
     OR to_regclass('public.idx_jft_office') IS NULL THEN
    RAISE EXCEPTION '034_jlwm_core: POST_APPLY_READINESS_FAILED — required core indexes missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_memory_edges'::regclass
      AND c.contype = 'f' AND c.conname = 'jlwm_memory_edges_from_node_id_fkey'
  ) INTO fk_from;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.jlwm_memory_edges'::regclass
      AND c.contype = 'f' AND c.conname = 'jlwm_memory_edges_to_node_id_fkey'
  ) INTO fk_to;

  SELECT COUNT(*) INTO orphan_from
  FROM jlwm_memory_edges e
  WHERE NOT EXISTS (SELECT 1 FROM jlwm_memory_nodes n WHERE n.id = e.from_node_id);
  SELECT COUNT(*) INTO orphan_to
  FROM jlwm_memory_edges e
  WHERE NOT EXISTS (SELECT 1 FROM jlwm_memory_nodes n WHERE n.id = e.to_node_id);

  IF fk_from AND fk_to THEN
    fk_status := 'INSTALLED';
  ELSIF orphan_from > 0 OR orphan_to > 0 THEN
    fk_status := format('DEFERRED orphan_from=%s orphan_to=%s', orphan_from, orphan_to);
  ELSE
    fk_status := 'PENDING';
  END IF;

  RAISE NOTICE
    '034_jlwm_core: post-apply readiness gate passed (14 tables; idx_jmn_uniq exact; twin/config UNIQUEs; fk_status=%)',
    fk_status;
END $$;

COMMIT;
