-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 053: Security Centers Runtime DDL schema authority (Stage 9)
--
-- Owns former Runtime CREATE/INDEX IIFEs from:
--   soc.ts            — security_sessions / security_alerts / blocked_ips /
--                       mfa_status_cache + 5 indexes
--   auditCenter.ts    — audit_coverage_rules / audit_risk_scores +
--                       idx_audit_logs_* on already-owned audit_logs (003)
--   complianceCenter.ts — compliance_controls / data_requests /
--                       retention_policies / legal_holds + 2 indexes
--   drCenter.ts       — dr_restore_points / dr_test_runs /
--                       dr_health_checks + proven FK CASCADE
--   mfaCenter.ts      — high_risk_op_log / recovery_codes + 2 indexes
--
-- Contract = proven Runtime CREATE + live DML (ON CONFLICT, SA routes, seeds).
-- Does NOT CREATE audit_logs (003). Does NOT rewrite document_retention_policies (033).
-- No invented UNIQUE/FK. Extra live columns never dropped/rewritten.
-- Idempotent. Fail-closed. No DROP TABLE / DROP INDEX.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── SOC ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  office_id    TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  device_type  TEXT DEFAULT 'unknown',
  browser      TEXT,
  os           TEXT,
  geo_country  TEXT,
  geo_city     TEXT,
  status       TEXT DEFAULT 'active',
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  last_seen    TIMESTAMPTZ DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  revoked_by   TEXT
);

CREATE TABLE IF NOT EXISTS security_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type   TEXT NOT NULL,
  severity     TEXT DEFAULT 'medium',
  title        TEXT NOT NULL,
  description  TEXT,
  user_id      TEXT,
  office_id    TEXT,
  ip_address   TEXT,
  metadata     JSONB DEFAULT '{}',
  status       TEXT DEFAULT 'open',
  resolved_at  TIMESTAMPTZ,
  resolved_by  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address   TEXT UNIQUE NOT NULL,
  reason       TEXT,
  blocked_by   TEXT,
  blocked_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  auto_blocked BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS mfa_status_cache (
  user_id      TEXT PRIMARY KEY,
  has_mfa      BOOLEAN DEFAULT false,
  checked_at   TIMESTAMPTZ DEFAULT NOW(),
  mfa_methods  JSONB DEFAULT '[]'
);

-- ── Audit Center ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_coverage_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource    TEXT NOT NULL UNIQUE,
  actions     TEXT[] DEFAULT '{}',
  risk_level  TEXT DEFAULT 'medium',
  enabled     BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_risk_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  office_id   TEXT,
  score       INTEGER DEFAULT 0,
  factors     JSONB DEFAULT '[]',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Compliance Center ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_controls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework   TEXT NOT NULL DEFAULT 'PDPL',
  control_id  TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'pending',
  evidence    TEXT,
  owner       TEXT,
  due_date    DATE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(framework, control_id)
);

CREATE TABLE IF NOT EXISTS data_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type  TEXT NOT NULL,
  requester_id  TEXT,
  office_id     TEXT,
  subject_email TEXT,
  status        TEXT DEFAULT 'pending',
  notes         TEXT,
  completed_at  TIMESTAMPTZ,
  completed_by  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retention_policies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type  TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL,
  auto_delete    BOOLEAN DEFAULT false,
  legal_hold     BOOLEAN DEFAULT false,
  last_run       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_holds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  resources   TEXT[],
  office_id   TEXT,
  created_by  TEXT,
  expires_at  TIMESTAMPTZ,
  status      TEXT DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── DR Center ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dr_restore_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  backup_type TEXT DEFAULT 'full',
  size_bytes  BIGINT DEFAULT 0,
  location    TEXT,
  checksum    TEXT,
  status      TEXT DEFAULT 'available',
  test_status TEXT DEFAULT 'untested',
  tested_at   TIMESTAMPTZ,
  rto_minutes INTEGER DEFAULT 60,
  rpo_minutes INTEGER DEFAULT 240,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dr_test_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restore_point_id UUID REFERENCES dr_restore_points(id) ON DELETE CASCADE,
  initiated_by     TEXT,
  status           TEXT DEFAULT 'running',
  result           JSONB DEFAULT '{}',
  duration_ms      INTEGER,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dr_health_checks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component  TEXT NOT NULL,
  status     TEXT DEFAULT 'healthy',
  latency_ms INTEGER,
  details    JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MFA Center ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS high_risk_op_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation     TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  office_id     TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  confirmed_mfa BOOLEAN DEFAULT false,
  confirmed_pwd BOOLEAN DEFAULT false,
  result        TEXT DEFAULT 'pending',
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  used       BOOLEAN DEFAULT false,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS geo_country TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS geo_city TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE security_sessions ADD COLUMN IF NOT EXISTS revoked_by TEXT;

ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS alert_type TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE security_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS blocked_by TEXT;
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN;

ALTER TABLE mfa_status_cache ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE mfa_status_cache ADD COLUMN IF NOT EXISTS has_mfa BOOLEAN;
ALTER TABLE mfa_status_cache ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
ALTER TABLE mfa_status_cache ADD COLUMN IF NOT EXISTS mfa_methods JSONB;

ALTER TABLE audit_coverage_rules ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE audit_coverage_rules ADD COLUMN IF NOT EXISTS resource TEXT;
ALTER TABLE audit_coverage_rules ADD COLUMN IF NOT EXISTS actions TEXT[];
ALTER TABLE audit_coverage_rules ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE audit_coverage_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN;
ALTER TABLE audit_coverage_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE audit_risk_scores ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE audit_risk_scores ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE audit_risk_scores ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE audit_risk_scores ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE audit_risk_scores ADD COLUMN IF NOT EXISTS factors JSONB;
ALTER TABLE audit_risk_scores ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ;

ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS framework TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS control_id TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS evidence TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS request_type TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS requester_id TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS subject_email TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS completed_by TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS retention_days INTEGER;
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS auto_delete BOOLEAN;
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN;
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS last_run TIMESTAMPTZ;
ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS resources TEXT[];
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS backup_type TEXT;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS test_status TEXT;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS tested_at TIMESTAMPTZ;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS rto_minutes INTEGER;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS rpo_minutes INTEGER;
ALTER TABLE dr_restore_points ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE dr_test_runs ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE dr_test_runs ADD COLUMN IF NOT EXISTS restore_point_id UUID;
ALTER TABLE dr_test_runs ADD COLUMN IF NOT EXISTS initiated_by TEXT;
ALTER TABLE dr_test_runs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE dr_test_runs ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE dr_test_runs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE dr_test_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE dr_test_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE dr_health_checks ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE dr_health_checks ADD COLUMN IF NOT EXISTS component TEXT;
ALTER TABLE dr_health_checks ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE dr_health_checks ADD COLUMN IF NOT EXISTS latency_ms INTEGER;
ALTER TABLE dr_health_checks ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE dr_health_checks ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS operation TEXT;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS confirmed_mfa BOOLEAN;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS confirmed_pwd BOOLEAN;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS result TEXT;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE high_risk_op_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE recovery_codes ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE recovery_codes ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE recovery_codes ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE recovery_codes ADD COLUMN IF NOT EXISTS used BOOLEAN;
ALTER TABLE recovery_codes ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
ALTER TABLE recovery_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('security_sessions','id','uuid'),
      ('security_sessions','session_id','text'),
      ('security_sessions','user_id','text'),
      ('security_sessions','office_id','text'),
      ('security_sessions','ip_address','text'),
      ('security_sessions','user_agent','text'),
      ('security_sessions','device_type','text'),
      ('security_sessions','browser','text'),
      ('security_sessions','os','text'),
      ('security_sessions','geo_country','text'),
      ('security_sessions','geo_city','text'),
      ('security_sessions','status','text'),
      ('security_sessions','started_at','timestamptz'),
      ('security_sessions','last_seen','timestamptz'),
      ('security_sessions','revoked_at','timestamptz'),
      ('security_sessions','revoked_by','text'),
      ('security_alerts','id','uuid'),
      ('security_alerts','alert_type','text'),
      ('security_alerts','severity','text'),
      ('security_alerts','title','text'),
      ('security_alerts','description','text'),
      ('security_alerts','user_id','text'),
      ('security_alerts','office_id','text'),
      ('security_alerts','ip_address','text'),
      ('security_alerts','metadata','jsonb'),
      ('security_alerts','status','text'),
      ('security_alerts','resolved_at','timestamptz'),
      ('security_alerts','resolved_by','text'),
      ('security_alerts','created_at','timestamptz'),
      ('blocked_ips','id','uuid'),
      ('blocked_ips','ip_address','text'),
      ('blocked_ips','reason','text'),
      ('blocked_ips','blocked_by','text'),
      ('blocked_ips','blocked_at','timestamptz'),
      ('blocked_ips','expires_at','timestamptz'),
      ('blocked_ips','auto_blocked','bool'),
      ('mfa_status_cache','user_id','text'),
      ('mfa_status_cache','has_mfa','bool'),
      ('mfa_status_cache','checked_at','timestamptz'),
      ('mfa_status_cache','mfa_methods','jsonb'),
      ('audit_coverage_rules','id','uuid'),
      ('audit_coverage_rules','resource','text'),
      ('audit_coverage_rules','actions','_text'),
      ('audit_coverage_rules','risk_level','text'),
      ('audit_coverage_rules','enabled','bool'),
      ('audit_coverage_rules','created_at','timestamptz'),
      ('audit_risk_scores','id','uuid'),
      ('audit_risk_scores','user_id','text'),
      ('audit_risk_scores','office_id','text'),
      ('audit_risk_scores','score','int4'),
      ('audit_risk_scores','factors','jsonb'),
      ('audit_risk_scores','computed_at','timestamptz'),
      ('compliance_controls','id','uuid'),
      ('compliance_controls','framework','text'),
      ('compliance_controls','control_id','text'),
      ('compliance_controls','title','text'),
      ('compliance_controls','description','text'),
      ('compliance_controls','status','text'),
      ('compliance_controls','evidence','text'),
      ('compliance_controls','owner','text'),
      ('compliance_controls','due_date','date'),
      ('compliance_controls','updated_at','timestamptz'),
      ('compliance_controls','created_at','timestamptz'),
      ('data_requests','id','uuid'),
      ('data_requests','request_type','text'),
      ('data_requests','requester_id','text'),
      ('data_requests','office_id','text'),
      ('data_requests','subject_email','text'),
      ('data_requests','status','text'),
      ('data_requests','notes','text'),
      ('data_requests','completed_at','timestamptz'),
      ('data_requests','completed_by','text'),
      ('data_requests','created_at','timestamptz'),
      ('retention_policies','id','uuid'),
      ('retention_policies','resource_type','text'),
      ('retention_policies','retention_days','int4'),
      ('retention_policies','auto_delete','bool'),
      ('retention_policies','legal_hold','bool'),
      ('retention_policies','last_run','timestamptz'),
      ('retention_policies','created_at','timestamptz'),
      ('legal_holds','id','uuid'),
      ('legal_holds','title','text'),
      ('legal_holds','description','text'),
      ('legal_holds','resources','_text'),
      ('legal_holds','office_id','text'),
      ('legal_holds','created_by','text'),
      ('legal_holds','expires_at','timestamptz'),
      ('legal_holds','status','text'),
      ('legal_holds','created_at','timestamptz'),
      ('dr_restore_points','id','uuid'),
      ('dr_restore_points','label','text'),
      ('dr_restore_points','backup_type','text'),
      ('dr_restore_points','size_bytes','int8'),
      ('dr_restore_points','location','text'),
      ('dr_restore_points','checksum','text'),
      ('dr_restore_points','status','text'),
      ('dr_restore_points','test_status','text'),
      ('dr_restore_points','tested_at','timestamptz'),
      ('dr_restore_points','rto_minutes','int4'),
      ('dr_restore_points','rpo_minutes','int4'),
      ('dr_restore_points','created_at','timestamptz'),
      ('dr_test_runs','id','uuid'),
      ('dr_test_runs','restore_point_id','uuid'),
      ('dr_test_runs','initiated_by','text'),
      ('dr_test_runs','status','text'),
      ('dr_test_runs','result','jsonb'),
      ('dr_test_runs','duration_ms','int4'),
      ('dr_test_runs','completed_at','timestamptz'),
      ('dr_test_runs','created_at','timestamptz'),
      ('dr_health_checks','id','uuid'),
      ('dr_health_checks','component','text'),
      ('dr_health_checks','status','text'),
      ('dr_health_checks','latency_ms','int4'),
      ('dr_health_checks','details','jsonb'),
      ('dr_health_checks','checked_at','timestamptz'),
      ('high_risk_op_log','id','uuid'),
      ('high_risk_op_log','operation','text'),
      ('high_risk_op_log','user_id','text'),
      ('high_risk_op_log','office_id','text'),
      ('high_risk_op_log','ip_address','text'),
      ('high_risk_op_log','user_agent','text'),
      ('high_risk_op_log','confirmed_mfa','bool'),
      ('high_risk_op_log','confirmed_pwd','bool'),
      ('high_risk_op_log','result','text'),
      ('high_risk_op_log','metadata','jsonb'),
      ('high_risk_op_log','created_at','timestamptz'),
      ('recovery_codes','id','uuid'),
      ('recovery_codes','user_id','text'),
      ('recovery_codes','code_hash','text'),
      ('recovery_codes','used','bool'),
      ('recovery_codes','used_at','timestamptz'),
      ('recovery_codes','created_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name=spec.table_name
      AND c.column_name=spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM security_sessions WHERE id IS NULL OR session_id IS NULL OR user_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — security_sessions has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM security_alerts WHERE id IS NULL OR alert_type IS NULL OR title IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — security_alerts has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM blocked_ips WHERE id IS NULL OR ip_address IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — blocked_ips has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM mfa_status_cache WHERE user_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — mfa_status_cache has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM audit_coverage_rules WHERE id IS NULL OR resource IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — audit_coverage_rules has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM audit_risk_scores WHERE id IS NULL OR user_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — audit_risk_scores has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM compliance_controls WHERE id IS NULL OR framework IS NULL OR control_id IS NULL OR title IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — compliance_controls has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM data_requests WHERE id IS NULL OR request_type IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — data_requests has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM retention_policies WHERE id IS NULL OR resource_type IS NULL OR retention_days IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — retention_policies has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM legal_holds WHERE id IS NULL OR title IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — legal_holds has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM dr_restore_points WHERE id IS NULL OR label IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — dr_restore_points has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM dr_test_runs WHERE id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — dr_test_runs has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM dr_health_checks WHERE id IS NULL OR component IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — dr_health_checks has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM high_risk_op_log WHERE id IS NULL OR operation IS NULL OR user_id IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — high_risk_op_log has % NULL required row(s)', null_cnt;
  END IF;
  SELECT COUNT(*) INTO null_cnt FROM recovery_codes WHERE id IS NULL OR user_id IS NULL OR code_hash IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — recovery_codes has % NULL required row(s)', null_cnt;
  END IF;
END $$;

ALTER TABLE security_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE security_sessions ALTER COLUMN device_type SET DEFAULT 'unknown';
ALTER TABLE security_sessions ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE security_sessions ALTER COLUMN started_at SET DEFAULT NOW();
ALTER TABLE security_sessions ALTER COLUMN last_seen SET DEFAULT NOW();

ALTER TABLE security_alerts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE security_alerts ALTER COLUMN severity SET DEFAULT 'medium';
ALTER TABLE security_alerts ALTER COLUMN metadata SET DEFAULT '{}';
ALTER TABLE security_alerts ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE security_alerts ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE blocked_ips ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE blocked_ips ALTER COLUMN blocked_at SET DEFAULT NOW();
ALTER TABLE blocked_ips ALTER COLUMN auto_blocked SET DEFAULT false;

ALTER TABLE mfa_status_cache ALTER COLUMN has_mfa SET DEFAULT false;
ALTER TABLE mfa_status_cache ALTER COLUMN checked_at SET DEFAULT NOW();
ALTER TABLE mfa_status_cache ALTER COLUMN mfa_methods SET DEFAULT '[]';

ALTER TABLE audit_coverage_rules ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE audit_coverage_rules ALTER COLUMN actions SET DEFAULT '{}';
ALTER TABLE audit_coverage_rules ALTER COLUMN risk_level SET DEFAULT 'medium';
ALTER TABLE audit_coverage_rules ALTER COLUMN enabled SET DEFAULT true;
ALTER TABLE audit_coverage_rules ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE audit_risk_scores ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE audit_risk_scores ALTER COLUMN score SET DEFAULT 0;
ALTER TABLE audit_risk_scores ALTER COLUMN factors SET DEFAULT '[]';
ALTER TABLE audit_risk_scores ALTER COLUMN computed_at SET DEFAULT NOW();

ALTER TABLE compliance_controls ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE compliance_controls ALTER COLUMN framework SET DEFAULT 'PDPL';
ALTER TABLE compliance_controls ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE compliance_controls ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE compliance_controls ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE data_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE data_requests ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE data_requests ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE retention_policies ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE retention_policies ALTER COLUMN auto_delete SET DEFAULT false;
ALTER TABLE retention_policies ALTER COLUMN legal_hold SET DEFAULT false;
ALTER TABLE retention_policies ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE legal_holds ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE legal_holds ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE legal_holds ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE dr_restore_points ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE dr_restore_points ALTER COLUMN backup_type SET DEFAULT 'full';
ALTER TABLE dr_restore_points ALTER COLUMN size_bytes SET DEFAULT 0;
ALTER TABLE dr_restore_points ALTER COLUMN status SET DEFAULT 'available';
ALTER TABLE dr_restore_points ALTER COLUMN test_status SET DEFAULT 'untested';
ALTER TABLE dr_restore_points ALTER COLUMN rto_minutes SET DEFAULT 60;
ALTER TABLE dr_restore_points ALTER COLUMN rpo_minutes SET DEFAULT 240;
ALTER TABLE dr_restore_points ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE dr_test_runs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE dr_test_runs ALTER COLUMN status SET DEFAULT 'running';
ALTER TABLE dr_test_runs ALTER COLUMN result SET DEFAULT '{}';
ALTER TABLE dr_test_runs ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE dr_health_checks ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE dr_health_checks ALTER COLUMN status SET DEFAULT 'healthy';
ALTER TABLE dr_health_checks ALTER COLUMN details SET DEFAULT '{}';
ALTER TABLE dr_health_checks ALTER COLUMN checked_at SET DEFAULT NOW();

ALTER TABLE high_risk_op_log ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE high_risk_op_log ALTER COLUMN confirmed_mfa SET DEFAULT false;
ALTER TABLE high_risk_op_log ALTER COLUMN confirmed_pwd SET DEFAULT false;
ALTER TABLE high_risk_op_log ALTER COLUMN result SET DEFAULT 'pending';
ALTER TABLE high_risk_op_log ALTER COLUMN metadata SET DEFAULT '{}';
ALTER TABLE high_risk_op_log ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE recovery_codes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE recovery_codes ALTER COLUMN used SET DEFAULT false;
ALTER TABLE recovery_codes ALTER COLUMN created_at SET DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE security_sessions ALTER COLUMN id SET NOT NULL;
  ALTER TABLE security_sessions ALTER COLUMN session_id SET NOT NULL;
  ALTER TABLE security_sessions ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE security_alerts ALTER COLUMN id SET NOT NULL;
  ALTER TABLE security_alerts ALTER COLUMN alert_type SET NOT NULL;
  ALTER TABLE security_alerts ALTER COLUMN title SET NOT NULL;
  ALTER TABLE blocked_ips ALTER COLUMN id SET NOT NULL;
  ALTER TABLE blocked_ips ALTER COLUMN ip_address SET NOT NULL;
  ALTER TABLE mfa_status_cache ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE audit_coverage_rules ALTER COLUMN id SET NOT NULL;
  ALTER TABLE audit_coverage_rules ALTER COLUMN resource SET NOT NULL;
  ALTER TABLE audit_risk_scores ALTER COLUMN id SET NOT NULL;
  ALTER TABLE audit_risk_scores ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE compliance_controls ALTER COLUMN id SET NOT NULL;
  ALTER TABLE compliance_controls ALTER COLUMN framework SET NOT NULL;
  ALTER TABLE compliance_controls ALTER COLUMN control_id SET NOT NULL;
  ALTER TABLE compliance_controls ALTER COLUMN title SET NOT NULL;
  ALTER TABLE data_requests ALTER COLUMN id SET NOT NULL;
  ALTER TABLE data_requests ALTER COLUMN request_type SET NOT NULL;
  ALTER TABLE retention_policies ALTER COLUMN id SET NOT NULL;
  ALTER TABLE retention_policies ALTER COLUMN resource_type SET NOT NULL;
  ALTER TABLE retention_policies ALTER COLUMN retention_days SET NOT NULL;
  ALTER TABLE legal_holds ALTER COLUMN id SET NOT NULL;
  ALTER TABLE legal_holds ALTER COLUMN title SET NOT NULL;
  ALTER TABLE dr_restore_points ALTER COLUMN id SET NOT NULL;
  ALTER TABLE dr_restore_points ALTER COLUMN label SET NOT NULL;
  ALTER TABLE dr_test_runs ALTER COLUMN id SET NOT NULL;
  ALTER TABLE dr_health_checks ALTER COLUMN id SET NOT NULL;
  ALTER TABLE dr_health_checks ALTER COLUMN component SET NOT NULL;
  ALTER TABLE high_risk_op_log ALTER COLUMN id SET NOT NULL;
  ALTER TABLE high_risk_op_log ALTER COLUMN operation SET NOT NULL;
  ALTER TABLE high_risk_op_log ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE recovery_codes ALTER COLUMN id SET NOT NULL;
  ALTER TABLE recovery_codes ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE recovery_codes ALTER COLUMN code_hash SET NOT NULL;
END $$;

-- PK (id) on owned tables except mfa_status_cache (PK user_id)
DO $$
DECLARE
  tbl TEXT;
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'security_sessions','security_alerts','blocked_ips',
    'audit_coverage_rules','audit_risk_scores',
    'compliance_controls','data_requests','retention_policies','legal_holds',
    'dr_restore_points','dr_test_runs','dr_health_checks',
    'high_risk_op_log','recovery_codes'
  ]::TEXT[] LOOP
    EXECUTE format(
      $q$SELECT EXISTS (
           SELECT 1 FROM pg_constraint c
           WHERE c.conrelid=%L::regclass AND c.contype='p'
         )$q$, 'public.' || tbl)
      INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION
          '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format(
        $q$SELECT COUNT(*) FROM (
             SELECT id FROM public.%I WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
           ) d$q$, tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=to_regclass(format('public.%I', tbl)) AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION
        '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  has_pk BOOLEAN;
  dup_cnt BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.mfa_status_cache'::regclass AND c.contype='p'
  ) INTO has_pk;
  IF NOT has_pk THEN
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT user_id FROM mfa_status_cache WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION
        '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate user_id blocks PK on mfa_status_cache';
    END IF;
    ALTER TABLE mfa_status_cache ADD CONSTRAINT mfa_status_cache_pkey PRIMARY KEY (user_id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.mfa_status_cache'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(user_id\)'
      AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION
      '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — mfa_status_cache PK is not solely (user_id)';
  END IF;
END $$;

-- Exact UNIQUEs required by ON CONFLICT (inspect ALL non-primary uniques)
DO $$
DECLARE
  spec RECORD;
  dup_cnt BIGINT;
  uq_rec RECORD;
  approved_unique_found BOOLEAN;
  has_incompatible_unique BOOLEAN;
  cols_ident TEXT;
  null_pred TEXT;
  i INT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('blocked_ips', ARRAY['ip_address']::TEXT[], 'blocked_ips_ip_address_key'),
      ('audit_coverage_rules', ARRAY['resource']::TEXT[], 'audit_coverage_rules_resource_key'),
      ('compliance_controls', ARRAY['framework','control_id']::TEXT[], 'compliance_controls_framework_control_id_key'),
      ('retention_policies', ARRAY['resource_type']::TEXT[], 'retention_policies_resource_type_key')
    ) AS t(table_name, cols, constraint_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_index x
      WHERE x.indrelid=to_regclass(format('public.%I', spec.table_name))
        AND x.indisunique AND NOT x.indisprimary
        AND (
          x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
          OR x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
        )
    ) THEN
      RAISE EXCEPTION
        '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — % UNIQUE index invalid/not-ready/partial/expression',
        spec.table_name;
    END IF;

    approved_unique_found := FALSE;
    has_incompatible_unique := FALSE;
    FOR uq_rec IN
      SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
      FROM pg_index x
      CROSS JOIN LATERAL unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
      WHERE x.indrelid=to_regclass(format('public.%I', spec.table_name))
        AND x.indisunique AND NOT x.indisprimary
        AND x.indpred IS NULL AND x.indexprs IS NULL
        AND x.indisvalid AND x.indisready
      GROUP BY x.indexrelid
    LOOP
      IF uq_rec.cols IS DISTINCT FROM spec.cols THEN
        has_incompatible_unique := TRUE;
      ELSE
        approved_unique_found := TRUE;
      END IF;
    END LOOP;

    IF has_incompatible_unique THEN
      RAISE EXCEPTION
        '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — % has incompatible UNIQUE index(es); require exactly UNIQUE(%)',
        spec.table_name, array_to_string(spec.cols, ', ');
    END IF;

    IF NOT approved_unique_found THEN
      cols_ident := '';
      null_pred := '';
      FOR i IN 1..cardinality(spec.cols) LOOP
        IF i > 1 THEN cols_ident := cols_ident || ', '; null_pred := null_pred || ' AND '; END IF;
        cols_ident := cols_ident || quote_ident(spec.cols[i]);
        null_pred := null_pred || quote_ident(spec.cols[i]) || ' IS NOT NULL';
      END LOOP;
      EXECUTE format(
        $q$SELECT COUNT(*) FROM (
             SELECT %s FROM public.%I WHERE %s GROUP BY %s HAVING COUNT(*) > 1
           ) d$q$, cols_ident, spec.table_name, null_pred, cols_ident)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — % has % duplicate (%) group(s)',
          spec.table_name, dup_cnt, array_to_string(spec.cols, ', ');
      END IF;
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%s)',
        spec.table_name, spec.constraint_name, cols_ident);
    END IF;
  END LOOP;
END $$;

-- Proven Runtime FK: dr_test_runs.restore_point_id → dr_restore_points(id) ON DELETE CASCADE
DO $$
DECLARE
  child_attnum INT2;
  ref_attnum INT2;
  orphan_cnt BIGINT;
  fk_ok BOOLEAN;
BEGIN
  IF to_regclass('public.dr_test_runs') IS NULL OR to_regclass('public.dr_restore_points') IS NULL THEN
    RAISE EXCEPTION
      '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — FK needs dr_restore_points + dr_test_runs';
  END IF;

  SELECT a.attnum INTO child_attnum
  FROM pg_attribute a
  WHERE a.attrelid='public.dr_test_runs'::regclass
    AND a.attname='restore_point_id' AND NOT a.attisdropped;
  SELECT a.attnum INTO ref_attnum
  FROM pg_attribute a
  WHERE a.attrelid='public.dr_restore_points'::regclass
    AND a.attname='id' AND NOT a.attisdropped;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.dr_test_runs'::regclass
      AND c.contype='f'
      AND c.conname='dr_test_runs_restore_point_id_fkey'
      AND NOT (
        c.confrelid='public.dr_restore_points'::regclass
        AND c.confdeltype='c'
        AND array_length(c.conkey, 1)=1 AND c.conkey[1]=child_attnum
        AND array_length(c.confkey, 1)=1 AND c.confkey[1]=ref_attnum
      )
  ) THEN
    RAISE EXCEPTION
      '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_FK) — dr_test_runs_restore_point_id_fkey wrong shape (expected CASCADE to dr_restore_points(id))';
  END IF;

  SELECT COUNT(*) INTO orphan_cnt FROM dr_test_runs r
  WHERE r.restore_point_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dr_restore_points p WHERE p.id=r.restore_point_id);
  IF orphan_cnt > 0 THEN
    RAISE EXCEPTION
      '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=ORPHAN_FK) — dr_test_runs has % orphan restore_point_id row(s) (rows preserved, no delete)',
      orphan_cnt;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.dr_test_runs'::regclass
      AND c.contype='f'
      AND c.conname='dr_test_runs_restore_point_id_fkey'
      AND c.confrelid='public.dr_restore_points'::regclass
      AND c.confdeltype='c'
      AND array_length(c.conkey, 1)=1 AND c.conkey[1]=child_attnum
      AND array_length(c.confkey, 1)=1 AND c.confkey[1]=ref_attnum
  ) INTO fk_ok;

  IF NOT fk_ok THEN
    ALTER TABLE dr_test_runs
      ADD CONSTRAINT dr_test_runs_restore_point_id_fkey
      FOREIGN KEY (restore_point_id) REFERENCES dr_restore_points(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Runtime indexes: global name probe (stolen name / DESC bits / UNIQUE / partial → INCOMPATIBLE_INDEX)
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
  index_options INT[];
  desc_ok BOOLEAN;
  opt_i INT;
  expected_len INT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_security_sessions_user','security_sessions',ARRAY['user_id']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_security_sessions_user ON security_sessions (user_id)'),
      ('idx_security_sessions_status','security_sessions',ARRAY['status']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_security_sessions_status ON security_sessions (status)'),
      ('idx_security_alerts_status','security_alerts',ARRAY['status']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts (status)'),
      ('idx_security_alerts_severity','security_alerts',ARRAY['severity']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts (severity)'),
      ('idx_blocked_ips_ip','blocked_ips',ARRAY['ip_address']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips (ip_address)'),
      ('idx_audit_logs_action','audit_logs',ARRAY['action']::text[],FALSE,TRUE,
       'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)'),
      ('idx_audit_logs_resource','audit_logs',ARRAY['resource']::text[],FALSE,TRUE,
       'CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource)'),
      ('idx_audit_logs_user_id','audit_logs',ARRAY['user_id']::text[],FALSE,TRUE,
       'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id)'),
      ('idx_audit_logs_office_id','audit_logs',ARRAY['office_id']::text[],FALSE,TRUE,
       'CREATE INDEX IF NOT EXISTS idx_audit_logs_office_id ON audit_logs (office_id)'),
      ('idx_audit_logs_created_at','audit_logs',ARRAY['created_at']::text[],TRUE,TRUE,
       'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)'),
      ('idx_data_requests_status','data_requests',ARRAY['status']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests (status)'),
      ('idx_compliance_controls_framework','compliance_controls',ARRAY['framework']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework ON compliance_controls (framework)'),
      ('idx_high_risk_op_user','high_risk_op_log',ARRAY['user_id']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_high_risk_op_user ON high_risk_op_log (user_id)'),
      ('idx_recovery_codes_user','recovery_codes',ARRAY['user_id']::text[],FALSE,FALSE,
       'CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes (user_id)')
    ) AS t(index_name, table_name, cols, last_desc, skip_if_table_missing, ddl)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));
    expected_len := cardinality(spec.cols);
    actual_table_oid := NULL;
    index_unique := NULL; index_partial := NULL; index_expression := NULL;
    index_valid := NULL; index_ready := NULL;
    index_columns := NULL; index_options := NULL;

    SELECT x.indrelid, x.indisunique, x.indpred IS NOT NULL, x.indexprs IS NOT NULL,
      x.indisvalid, x.indisready,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
       LEFT JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality))
    INTO actual_table_oid, index_unique, index_partial, index_expression,
      index_valid, index_ready, index_columns, index_options
    FROM pg_class i
    JOIN pg_namespace n ON n.oid=i.relnamespace
    LEFT JOIN pg_index x ON x.indexrelid=i.oid
    WHERE n.nspname='public' AND i.relname=spec.index_name;

    IF FOUND THEN
      desc_ok := true;
      IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM expected_len THEN
        desc_ok := false;
      ELSE
        FOR opt_i IN 1 .. expected_len LOOP
          IF spec.last_desc AND opt_i = expected_len THEN
            IF (index_options[opt_i] & 1) IS DISTINCT FROM 1 THEN desc_ok := false; END IF;
          ELSE
            IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
          END IF;
        END LOOP;
      END IF;
      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS DISTINCT FROM FALSE
         OR index_partial IS DISTINCT FROM FALSE
         OR index_expression IS DISTINCT FROM FALSE
         OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE
         OR index_columns IS DISTINCT FROM spec.cols
         OR desc_ok IS NOT TRUE THEN
        RAISE EXCEPTION
          '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (cols=% opts=%). No DROP INDEX.',
          spec.index_name, index_columns, index_options;
      END IF;
    ELSE
      IF expected_table_oid IS NULL THEN
        IF spec.skip_if_table_missing THEN
          RAISE NOTICE '053_security_centers: skipping % — table % missing', spec.index_name, spec.table_name;
          CONTINUE;
        END IF;
        RAISE EXCEPTION
          '053_security_centers: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — % needs %',
          spec.index_name, spec.table_name;
      END IF;
      EXECUTE spec.ddl;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='blocked_ips' AND column_name='ip_address'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '053_security_centers: POST_APPLY_READINESS_FAILED — blocked_ips.ip_address TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.blocked_ips'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*ip_address\s*\)'
      AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,'
  ) THEN
    RAISE EXCEPTION '053_security_centers: POST_APPLY_READINESS_FAILED — blocked_ips UNIQUE(ip_address) missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.compliance_controls'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*framework\s*,\s*control_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,[^)]*,'
  ) THEN
    RAISE EXCEPTION '053_security_centers: POST_APPLY_READINESS_FAILED — compliance_controls UNIQUE(framework, control_id) missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.retention_policies'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*resource_type\s*\)'
      AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,'
  ) THEN
    RAISE EXCEPTION '053_security_centers: POST_APPLY_READINESS_FAILED — retention_policies UNIQUE(resource_type) missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.mfa_status_cache'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(user_id\)'
  ) THEN
    RAISE EXCEPTION '053_security_centers: POST_APPLY_READINESS_FAILED — mfa_status_cache PK(user_id) missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.dr_test_runs'::regclass AND c.contype='f'
      AND c.conname='dr_test_runs_restore_point_id_fkey'
  ) THEN
    RAISE EXCEPTION '053_security_centers: POST_APPLY_READINESS_FAILED — dr_test_runs_restore_point_id_fkey missing';
  END IF;
  IF to_regclass('public.idx_security_sessions_user') IS NULL
     OR to_regclass('public.idx_blocked_ips_ip') IS NULL
     OR to_regclass('public.idx_data_requests_status') IS NULL
     OR to_regclass('public.idx_high_risk_op_user') IS NULL THEN
    RAISE EXCEPTION '053_security_centers: POST_APPLY_READINESS_FAILED — required indexes missing';
  END IF;
  IF to_regclass('public.audit_logs') IS NOT NULL AND to_regclass('public.idx_audit_logs_created_at') IS NULL THEN
    RAISE EXCEPTION '053_security_centers: POST_APPLY_READINESS_FAILED — idx_audit_logs_created_at missing';
  END IF;

  RAISE NOTICE '053_security_centers: post-apply FULL READY (reason=SECURITY_CENTERS_SCHEMA_READY; UNIQUEs; FK CASCADE; Runtime indexes)';
END $$;

COMMIT;
