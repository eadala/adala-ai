-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 054: Platform Runtime DDL schema authority (Stage 9)
--
-- Owns former Runtime CREATE/INDEX IIFEs from:
--   control-tower.ts    — ct_security_events (message/metadata columns)
--   launchGate.ts       — ct_security_events + idx_ct_sec_events_*
--   governanceKernel.ts — governance_action_log + idx_gov_log_created
--   certification.ts    — go_live_certificates (UNIQUE certificate_id)
--   admin.ts            — system_audit_logs + idx_sys_audit_*
--   engineering.ts      — engineering_tasks/scans/ip_whitelist/logs
--   production-os.ts    — prod_incidents / prod_heal_log
--   productionLaunch.ts — launch_events
--   saas-os.ts          — os_events / os_action_queue
--
-- ct_security_events contract = launchGate/runtimeShield shape + control-tower
-- message/metadata columns (both Runtime variants merged; no id rewrite).
-- No invented FK. engineering_ip_whitelist UNIQUE(ip_address) from Runtime.
-- Idempotent. Fail-closed. No DROP TABLE / DROP INDEX.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ct_security_events (launchGate + control-tower extras) ────────────────
CREATE TABLE IF NOT EXISTS ct_security_events (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type     TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'P3',
  description    TEXT,
  request_path   TEXT,
  request_method TEXT,
  client_ip      TEXT,
  user_id        TEXT,
  office_id      TEXT,
  resolved       BOOLEAN DEFAULT false,
  resolved_at    TIMESTAMPTZ,
  message        TEXT,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS request_path TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS request_method TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS client_ip TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS resolved BOOLEAN;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE ct_security_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── governance_action_log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS governance_action_log (
  id          BIGSERIAL PRIMARY KEY,
  action_type TEXT        NOT NULL,
  source      TEXT        NOT NULL DEFAULT 'unknown',
  status      TEXT        NOT NULL DEFAULT 'queued',
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE governance_action_log ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE governance_action_log ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE governance_action_log ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE governance_action_log ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE governance_action_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE governance_action_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── go_live_certificates ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS go_live_certificates (
  id              BIGSERIAL    PRIMARY KEY,
  certificate_id  TEXT         NOT NULL UNIQUE,
  score           INT          NOT NULL,
  status          TEXT         NOT NULL,
  risk_level      TEXT         NOT NULL,
  axes            JSONB        NOT NULL DEFAULT '{}',
  blockers        JSONB        NOT NULL DEFAULT '[]',
  generated_by    TEXT,
  valid_until     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS certificate_id TEXT;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS score INT;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS axes JSONB;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS blockers JSONB;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS generated_by TEXT;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE go_live_certificates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── system_audit_logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  office_id     TEXT,
  action_type   TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  reason        TEXT,
  ip_address    TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS admin_user_id TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS resource_id TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE system_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ── engineering_* ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engineering_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT DEFAULT 'pending',
  priority     TEXT DEFAULT 'medium',
  category     TEXT DEFAULT 'general',
  result       JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS engineering_scans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type  TEXT NOT NULL,
  status     TEXT DEFAULT 'pending',
  findings   JSONB,
  summary    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engineering_ip_whitelist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  label      TEXT,
  added_by   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engineering_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action     TEXT NOT NULL,
  details    JSONB,
  user_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── production-os ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prod_incidents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alerts        JSONB NOT NULL DEFAULT '[]',
  severity      TEXT  NOT NULL DEFAULT 'low',
  actions_taken JSONB NOT NULL DEFAULT '[]',
  metrics_snap  JSONB NOT NULL DEFAULT '{}',
  status        TEXT  NOT NULL DEFAULT 'open',
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prod_heal_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL,
  target      TEXT,
  result      TEXT,
  office_id   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── productionLaunch ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS launch_events (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  launched_by   TEXT NOT NULL,
  phase         TEXT NOT NULL DEFAULT 'production',
  gate_score    INT,
  decision      TEXT,
  notes         TEXT,
  docker_config TEXT,
  launched_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── saas-os ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS os_events (
  id         BIGSERIAL PRIMARY KEY,
  event      TEXT        NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}',
  source     TEXT        NOT NULL DEFAULT 'manual',
  office_id  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS os_action_queue (
  id          BIGSERIAL PRIMARY KEY,
  type        TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  status      TEXT        NOT NULL DEFAULT 'queued',
  safety_ok   BOOLEAN     NOT NULL DEFAULT TRUE,
  triggered_by TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation (fail-closed)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('ct_security_events','event_type','text'),
      ('ct_security_events','severity','text'),
      ('ct_security_events','metadata','jsonb'),
      ('governance_action_log','action_type','text'),
      ('governance_action_log','source','text'),
      ('governance_action_log','status','text'),
      ('go_live_certificates','certificate_id','text'),
      ('go_live_certificates','score','int4'),
      ('go_live_certificates','status','text'),
      ('system_audit_logs','admin_user_id','text'),
      ('system_audit_logs','action_type','text'),
      ('engineering_tasks','title','text'),
      ('engineering_scans','scan_type','text'),
      ('engineering_ip_whitelist','ip_address','text'),
      ('engineering_logs','action','text'),
      ('prod_incidents','severity','text'),
      ('prod_heal_log','action','text'),
      ('launch_events','launched_by','text'),
      ('os_events','event','text'),
      ('os_action_queue','type','text')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    IF to_regclass('public.' || spec.table_name) IS NULL THEN CONTINUE; END IF;
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=spec.table_name
      AND c.column_name=spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '054_platform_runtime: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;
END $$;

-- Defaults (exact Runtime)
ALTER TABLE ct_security_events ALTER COLUMN severity SET DEFAULT 'P3';
ALTER TABLE ct_security_events ALTER COLUMN resolved SET DEFAULT false;
ALTER TABLE ct_security_events ALTER COLUMN metadata SET DEFAULT '{}';
ALTER TABLE ct_security_events ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE governance_action_log ALTER COLUMN source SET DEFAULT 'unknown';
ALTER TABLE governance_action_log ALTER COLUMN status SET DEFAULT 'queued';
ALTER TABLE governance_action_log ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE go_live_certificates ALTER COLUMN axes SET DEFAULT '{}';
ALTER TABLE go_live_certificates ALTER COLUMN blockers SET DEFAULT '[]';
ALTER TABLE go_live_certificates ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE system_audit_logs ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE engineering_tasks ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE engineering_tasks ALTER COLUMN priority SET DEFAULT 'medium';
ALTER TABLE engineering_tasks ALTER COLUMN category SET DEFAULT 'general';
ALTER TABLE engineering_tasks ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE engineering_scans ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE engineering_scans ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE engineering_logs ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE engineering_ip_whitelist ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE prod_incidents ALTER COLUMN alerts SET DEFAULT '[]';
ALTER TABLE prod_incidents ALTER COLUMN severity SET DEFAULT 'low';
ALTER TABLE prod_incidents ALTER COLUMN actions_taken SET DEFAULT '[]';
ALTER TABLE prod_incidents ALTER COLUMN metrics_snap SET DEFAULT '{}';
ALTER TABLE prod_incidents ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE prod_incidents ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE prod_heal_log ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE launch_events ALTER COLUMN phase SET DEFAULT 'production';
ALTER TABLE launch_events ALTER COLUMN launched_at SET DEFAULT NOW();

ALTER TABLE os_events ALTER COLUMN data SET DEFAULT '{}';
ALTER TABLE os_events ALTER COLUMN source SET DEFAULT 'manual';
ALTER TABLE os_events ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE os_action_queue ALTER COLUMN payload SET DEFAULT '{}';
ALTER TABLE os_action_queue ALTER COLUMN status SET DEFAULT 'queued';
ALTER TABLE os_action_queue ALTER COLUMN safety_ok SET DEFAULT TRUE;
ALTER TABLE os_action_queue ALTER COLUMN created_at SET DEFAULT NOW();

-- UNIQUE probes (certificate_id, ip_address)
DO $$
DECLARE
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  IF to_regclass('public.go_live_certificates') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.go_live_certificates'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*certificate_id\s*\)'
        AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,'
    ) THEN
      SELECT COUNT(*) INTO null_cnt FROM go_live_certificates WHERE certificate_id IS NULL;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '054_platform_runtime: BLOCK (reason_code=NULL_REQUIRED) — NULL certificate_id blocks UNIQUE';
      END IF;
      SELECT COUNT(*) INTO dup_cnt
      FROM (SELECT certificate_id FROM go_live_certificates GROUP BY certificate_id HAVING COUNT(*) > 1) d;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '054_platform_runtime: BLOCK (reason_code=DUPLICATE_UNIQUE_KEY) — duplicate certificate_id';
      END IF;
      ALTER TABLE go_live_certificates ADD CONSTRAINT go_live_certificates_certificate_id_key UNIQUE (certificate_id);
    END IF;
  END IF;

  IF to_regclass('public.engineering_ip_whitelist') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.engineering_ip_whitelist'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*ip_address\s*\)'
        AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,'
    ) THEN
      SELECT COUNT(*) INTO null_cnt FROM engineering_ip_whitelist WHERE ip_address IS NULL;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION '054_platform_runtime: BLOCK (reason_code=NULL_REQUIRED) — NULL ip_address blocks UNIQUE';
      END IF;
      SELECT COUNT(*) INTO dup_cnt
      FROM (SELECT ip_address FROM engineering_ip_whitelist GROUP BY ip_address HAVING COUNT(*) > 1) d;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION '054_platform_runtime: BLOCK (reason_code=DUPLICATE_UNIQUE_KEY) — duplicate ip_address';
      END IF;
      ALTER TABLE engineering_ip_whitelist ADD CONSTRAINT engineering_ip_whitelist_ip_address_key UNIQUE (ip_address);
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes (fail-closed shape validation)
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
  index_options INT[];
  desc_ok BOOLEAN;
  opt_i INT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      (
        'idx_ct_sec_events_severity',
        'ct_security_events',
        ARRAY['severity','resolved','created_at']::text[],
        TRUE,
        $c$CREATE INDEX IF NOT EXISTS idx_ct_sec_events_severity ON ct_security_events(severity, resolved, created_at DESC)$c$
      ),
      (
        'idx_ct_sec_events_office',
        'ct_security_events',
        ARRAY['office_id','created_at']::text[],
        TRUE,
        $c$CREATE INDEX IF NOT EXISTS idx_ct_sec_events_office ON ct_security_events(office_id, created_at DESC)$c$
      ),
      (
        'idx_gov_log_created',
        'governance_action_log',
        ARRAY['created_at']::text[],
        TRUE,
        $c$CREATE INDEX IF NOT EXISTS idx_gov_log_created ON governance_action_log(created_at DESC)$c$
      ),
      (
        'idx_sys_audit_admin',
        'system_audit_logs',
        ARRAY['admin_user_id','created_at']::text[],
        TRUE,
        $c$CREATE INDEX IF NOT EXISTS idx_sys_audit_admin ON system_audit_logs(admin_user_id, created_at DESC)$c$
      ),
      (
        'idx_sys_audit_office',
        'system_audit_logs',
        ARRAY['office_id','created_at']::text[],
        TRUE,
        $c$CREATE INDEX IF NOT EXISTS idx_sys_audit_office ON system_audit_logs(office_id, created_at DESC)$c$
      )
    ) AS t(index_name, table_name, expected_cols, expect_last_desc, create_sql)
  LOOP
    expected_table_oid := to_regclass(format('public.%I', spec.table_name));

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
      IF index_options IS NULL
         OR cardinality(index_options) IS DISTINCT FROM cardinality(spec.expected_cols) THEN
        desc_ok := false;
      ELSE
        FOR opt_i IN 1 .. cardinality(spec.expected_cols) LOOP
          IF opt_i = cardinality(spec.expected_cols) AND spec.expect_last_desc THEN
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
         OR index_columns IS DISTINCT FROM spec.expected_cols
         OR desc_ok IS NOT TRUE THEN
        RAISE EXCEPTION
          '054_platform_runtime: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (cols=% opts=%). No DROP INDEX.',
          spec.index_name, index_columns, index_options;
      END IF;
    ELSE
      IF expected_table_oid IS NULL THEN
        RAISE NOTICE '054_platform_runtime: skipping % — table % missing', spec.index_name, spec.table_name;
        CONTINUE;
      END IF;
      EXECUTE spec.create_sql;
    END IF;
  END LOOP;
END $$;

-- Post-apply readiness
DO $$
BEGIN
  IF to_regclass('public.ct_security_events') IS NULL
     OR to_regclass('public.governance_action_log') IS NULL
     OR to_regclass('public.go_live_certificates') IS NULL
     OR to_regclass('public.system_audit_logs') IS NULL
     OR to_regclass('public.engineering_tasks') IS NULL
     OR to_regclass('public.prod_incidents') IS NULL
     OR to_regclass('public.launch_events') IS NULL
     OR to_regclass('public.os_events') IS NULL
     OR to_regclass('public.os_action_queue') IS NULL THEN
    RAISE EXCEPTION '054_platform_runtime: POST_APPLY_READINESS_FAILED — core platform tables missing';
  END IF;
  IF to_regclass('public.idx_ct_sec_events_severity') IS NULL
     OR to_regclass('public.idx_gov_log_created') IS NULL
     OR to_regclass('public.idx_sys_audit_admin') IS NULL THEN
    RAISE EXCEPTION '054_platform_runtime: POST_APPLY_READINESS_FAILED — required indexes missing';
  END IF;
  RAISE NOTICE '054_platform_runtime: post-apply FULL READY (reason=PLATFORM_RUNTIME_SCHEMA_READY)';
END $$;

COMMIT;
