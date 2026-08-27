-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 055: Platform Runtime DDL schema authority batch 2 (Stage 9)
--
-- Owns former Runtime CREATE/INDEX from:
--   developer.ts          — developer_impersonation / ghost_access_log / developer_accounts
--   tenantDebug.ts        — tenant_audit_logs + idx_tenant_audit_*
--   infrastructure.ts     — office_isolation_config
--   orgStructure.ts       — organization_units + proven parent_id FK SET NULL
--   managedIntegrations.ts — platform_integrations / office_integration_status /
--                            integration_requests + indexes + UNIQUE(office_id, integration_key)
--   demo-sync.ts          — demo_sync_log
--   platformCommand.ts    — pcc_command_log
--   themeBuilder.ts       — office_themes
--   tenantVersioning.ts   — tenant_bindings / tenant_binding_history /
--                           tenant_audit_archive + Runtime indexes
--
-- Seed DML for platform_integrations stays in managedIntegrations.ts (ON CONFLICT).
-- compressAuditLogs DELETE DML in tenantVersioning.ts preserved (not migration).
-- Idempotent. Fail-closed. No DROP TABLE / DROP INDEX.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── developer.ts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS developer_impersonation (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_user_id    TEXT NOT NULL UNIQUE,
  impersonated_office_id TEXT NOT NULL,
  office_name            TEXT DEFAULT '',
  started_at             TIMESTAMPTZ DEFAULT NOW(),
  expires_at             TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ghost_access_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  office_id     TEXT NOT NULL,
  office_name   TEXT,
  action        TEXT NOT NULL,
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS developer_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  clerk_user_id TEXT,
  permissions   JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── tenantDebug.ts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_audit_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT NOT NULL,
  tenant_id   TEXT,
  source      TEXT NOT NULL,
  steps       JSONB NOT NULL DEFAULT '[]',
  resolved    BOOLEAN NOT NULL DEFAULT false,
  error_msg   TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── infrastructure.ts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_isolation_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id           TEXT NOT NULL UNIQUE,
  isolation_mode      TEXT NOT NULL DEFAULT 'shared',
  dedicated_db_url    TEXT,
  dedicated_bucket    TEXT,
  encryption_key_id   TEXT,
  encryption_key_hint TEXT,
  backup_enabled      BOOLEAN DEFAULT FALSE,
  backup_frequency    TEXT DEFAULT 'daily',
  notes               TEXT,
  upgraded_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── orgStructure.ts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_units (
  id           SERIAL PRIMARY KEY,
  firm_id      TEXT NOT NULL DEFAULT 'default',
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'DEPARTMENT',
  parent_id    INTEGER REFERENCES organization_units(id) ON DELETE SET NULL,
  manager_id   TEXT,
  manager_name TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── managedIntegrations.ts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_integrations (
  key             TEXT PRIMARY KEY,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  icon            TEXT NOT NULL DEFAULT '🔌',
  color           TEXT NOT NULL DEFAULT '#6B7280',
  description     TEXT NOT NULL DEFAULT '',
  plan_required   TEXT NOT NULL DEFAULT 'free',
  docs_url        TEXT,
  features        JSONB DEFAULT '[]',
  global_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  config          JSONB DEFAULT '{}',
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_integration_status (
  id              SERIAL PRIMARY KEY,
  office_id       TEXT NOT NULL,
  integration_key TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at    TIMESTAMPTZ,
  deactivated_at  TIMESTAMPTZ,
  config          JSONB DEFAULT '{}',
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(office_id, integration_key)
);

CREATE TABLE IF NOT EXISTS integration_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       TEXT NOT NULL,
  office_name     TEXT,
  integration_key TEXT NOT NULL,
  request_type    TEXT NOT NULL DEFAULT 'activate',
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  admin_notes     TEXT,
  resolved_by     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── demo-sync.ts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_sync_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id     TEXT NOT NULL,
  office_label  TEXT NOT NULL,
  synced_plan   TEXT,
  actions_count INT DEFAULT 0,
  triggered_by  TEXT DEFAULT 'manual',
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── platformCommand.ts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pcc_command_log (
  id         BIGSERIAL PRIMARY KEY,
  command    TEXT NOT NULL,
  result     JSONB,
  user_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── themeBuilder.ts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS office_themes (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT 'الثيم المخصص',
  tokens     JSONB NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  scope      TEXT DEFAULT 'both',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── tenantVersioning.ts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_bindings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE,
  tenant_id  TEXT NOT NULL,
  version    INT  NOT NULL DEFAULT 1,
  source     TEXT NOT NULL DEFAULT 'office_members',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_binding_history (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  tenant_id  TEXT NOT NULL,
  version    INT  NOT NULL,
  source     TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_audit_archive (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     TEXT,
  period        DATE NOT NULL,
  total         INT  NOT NULL DEFAULT 0,
  failures      INT  NOT NULL DEFAULT 0,
  sources       JSONB NOT NULL DEFAULT '[]',
  compressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation (fail-closed subset — proven DML columns)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('developer_impersonation','super_admin_user_id','text'),
      ('ghost_access_log','action','text'),
      ('developer_accounts','email','text'),
      ('tenant_audit_logs','user_id','text'),
      ('tenant_audit_logs','source','text'),
      ('office_isolation_config','office_id','text'),
      ('organization_units','name','text'),
      ('platform_integrations','key','text'),
      ('office_integration_status','office_id','text'),
      ('integration_requests','office_id','text'),
      ('demo_sync_log','office_id','text'),
      ('pcc_command_log','command','text'),
      ('office_themes','user_id','text'),
      ('office_themes','tokens','jsonb'),
      ('tenant_bindings','user_id','text'),
      ('tenant_bindings','tenant_id','text'),
      ('tenant_binding_history','user_id','text'),
      ('tenant_audit_archive','period','date')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    IF to_regclass('public.' || spec.table_name) IS NULL THEN CONTINUE; END IF;
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=spec.table_name
      AND c.column_name=spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '055_platform_runtime_b2: BLOCK (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;
END $$;

-- UNIQUE probes (proven ON CONFLICT / Runtime UNIQUE)
DO $$
DECLARE
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  IF to_regclass('public.developer_impersonation') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.developer_impersonation'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*super_admin_user_id\s*\)'
    ) THEN
      SELECT COUNT(*) INTO null_cnt FROM developer_impersonation WHERE super_admin_user_id IS NULL;
      IF null_cnt > 0 THEN RAISE EXCEPTION '055: NULL super_admin_user_id blocks UNIQUE'; END IF;
      SELECT COUNT(*) INTO dup_cnt FROM (SELECT super_admin_user_id FROM developer_impersonation GROUP BY super_admin_user_id HAVING COUNT(*) > 1) d;
      IF dup_cnt > 0 THEN RAISE EXCEPTION '055: DUPLICATE super_admin_user_id'; END IF;
      ALTER TABLE developer_impersonation ADD CONSTRAINT developer_impersonation_super_admin_user_id_key UNIQUE (super_admin_user_id);
    END IF;
  END IF;

  IF to_regclass('public.developer_accounts') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.developer_accounts'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*email\s*\)'
    ) THEN
      SELECT COUNT(*) INTO null_cnt FROM developer_accounts WHERE email IS NULL;
      IF null_cnt > 0 THEN RAISE EXCEPTION '055: NULL email blocks UNIQUE'; END IF;
      SELECT COUNT(*) INTO dup_cnt FROM (SELECT email FROM developer_accounts GROUP BY email HAVING COUNT(*) > 1) d;
      IF dup_cnt > 0 THEN RAISE EXCEPTION '055: DUPLICATE email'; END IF;
      ALTER TABLE developer_accounts ADD CONSTRAINT developer_accounts_email_key UNIQUE (email);
    END IF;
  END IF;

  IF to_regclass('public.office_isolation_config') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.office_isolation_config'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*\)'
        AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,'
    ) THEN
      SELECT COUNT(*) INTO null_cnt FROM office_isolation_config WHERE office_id IS NULL;
      IF null_cnt > 0 THEN RAISE EXCEPTION '055: NULL office_id blocks UNIQUE'; END IF;
      SELECT COUNT(*) INTO dup_cnt FROM (SELECT office_id FROM office_isolation_config GROUP BY office_id HAVING COUNT(*) > 1) d;
      IF dup_cnt > 0 THEN RAISE EXCEPTION '055: DUPLICATE office_id'; END IF;
      ALTER TABLE office_isolation_config ADD CONSTRAINT office_isolation_config_office_id_key UNIQUE (office_id);
    END IF;
  END IF;

  IF to_regclass('public.office_integration_status') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.office_integration_status'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*,\s*integration_key\s*\)'
    ) THEN
      SELECT COUNT(*) INTO dup_cnt FROM (
        SELECT office_id, integration_key FROM office_integration_status
        GROUP BY office_id, integration_key HAVING COUNT(*) > 1
      ) d;
      IF dup_cnt > 0 THEN RAISE EXCEPTION '055: DUPLICATE (office_id, integration_key)'; END IF;
      ALTER TABLE office_integration_status ADD CONSTRAINT office_integration_status_office_id_integration_key_key UNIQUE (office_id, integration_key);
    END IF;
  END IF;

  IF to_regclass('public.tenant_bindings') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.tenant_bindings'::regclass AND c.contype='u'
        AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*user_id\s*\)'
    ) THEN
      SELECT COUNT(*) INTO null_cnt FROM tenant_bindings WHERE user_id IS NULL;
      IF null_cnt > 0 THEN RAISE EXCEPTION '055: NULL user_id blocks UNIQUE'; END IF;
      SELECT COUNT(*) INTO dup_cnt FROM (SELECT user_id FROM tenant_bindings GROUP BY user_id HAVING COUNT(*) > 1) d;
      IF dup_cnt > 0 THEN RAISE EXCEPTION '055: DUPLICATE user_id'; END IF;
      ALTER TABLE tenant_bindings ADD CONSTRAINT tenant_bindings_user_id_key UNIQUE (user_id);
    END IF;
  END IF;

  IF to_regclass('public.tenant_audit_archive') IS NOT NULL
     AND to_regclass('public.idx_taa_tenant_period') IS NULL THEN
    CREATE UNIQUE INDEX idx_taa_tenant_period ON tenant_audit_archive(tenant_id, period);
  END IF;
END $$;

-- organization_units parent_id FK (proven Runtime ON DELETE SET NULL)
DO $$
BEGIN
  IF to_regclass('public.organization_units') IS NULL THEN
    NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.organization_units'::regclass AND c.contype = 'f'
      AND c.conname = 'organization_units_parent_id_fkey'
  ) THEN
    ALTER TABLE organization_units
      ADD CONSTRAINT organization_units_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES organization_units(id) ON DELETE SET NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.organization_units'::regclass AND c.contype = 'f'
      AND a.attname = 'parent_id'
      AND pg_get_constraintdef(c.oid) ~* 'REFERENCES organization_units\(id\)'
      AND pg_get_constraintdef(c.oid) ~* 'ON DELETE SET NULL'
  ) THEN
    RAISE EXCEPTION
      '055_platform_runtime_b2: BLOCK (reason_code=INCOMPATIBLE_FK) — organization_units.parent_id FK shape wrong';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes (fail-closed; idx_taa_tenant_period handled as UNIQUE above)
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
      ('idx_tenant_audit_user', 'tenant_audit_logs', ARRAY['user_id']::text[], FALSE, FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_tenant_audit_user ON tenant_audit_logs(user_id)$c$),
      ('idx_tenant_audit_time', 'tenant_audit_logs', ARRAY['created_at']::text[], TRUE, FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_tenant_audit_time ON tenant_audit_logs(created_at DESC)$c$),
      ('idx_tenant_audit_source', 'tenant_audit_logs', ARRAY['source']::text[], FALSE, FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_tenant_audit_source ON tenant_audit_logs(source)$c$),
      ('idx_ois_office', 'office_integration_status', ARRAY['office_id']::text[], FALSE, FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_ois_office ON office_integration_status(office_id)$c$),
      ('idx_ir_status', 'integration_requests', ARRAY['status','created_at']::text[], TRUE, FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_ir_status ON integration_requests(status, created_at DESC)$c$),
      ('idx_tb_user', 'tenant_bindings', ARRAY['user_id']::text[], FALSE, FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_tb_user ON tenant_bindings(user_id)$c$),
      ('idx_tbh_user', 'tenant_binding_history', ARRAY['user_id']::text[], FALSE, FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_tbh_user ON tenant_binding_history(user_id)$c$),
      ('idx_tbh_version', 'tenant_binding_history', ARRAY['user_id','version']::text[], TRUE, FALSE,
        $c$CREATE INDEX IF NOT EXISTS idx_tbh_version ON tenant_binding_history(user_id, version DESC)$c$)
    ) AS t(index_name, table_name, expected_cols, expect_last_desc, expect_unique, create_sql)
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
         OR index_unique IS DISTINCT FROM spec.expect_unique
         OR index_partial IS DISTINCT FROM FALSE
         OR index_expression IS DISTINCT FROM FALSE
         OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE
         OR index_columns IS DISTINCT FROM spec.expected_cols
         OR desc_ok IS NOT TRUE THEN
        RAISE EXCEPTION
          '055_platform_runtime_b2: BLOCK (reason_code=INCOMPATIBLE_INDEX) — % incompatible. No DROP INDEX.',
          spec.index_name;
      END IF;
    ELSE
      IF expected_table_oid IS NULL THEN
        RAISE NOTICE '055_platform_runtime_b2: skipping % — table % missing', spec.index_name, spec.table_name;
        CONTINUE;
      END IF;
      EXECUTE spec.create_sql;
    END IF;
  END LOOP;
END $$;

-- Post-apply readiness (all 15 tables + 8 indexes + unique archive index)
DO $$
BEGIN
  IF to_regclass('public.developer_impersonation') IS NULL
     OR to_regclass('public.ghost_access_log') IS NULL
     OR to_regclass('public.developer_accounts') IS NULL
     OR to_regclass('public.tenant_audit_logs') IS NULL
     OR to_regclass('public.office_isolation_config') IS NULL
     OR to_regclass('public.organization_units') IS NULL
     OR to_regclass('public.platform_integrations') IS NULL
     OR to_regclass('public.office_integration_status') IS NULL
     OR to_regclass('public.integration_requests') IS NULL
     OR to_regclass('public.demo_sync_log') IS NULL
     OR to_regclass('public.pcc_command_log') IS NULL
     OR to_regclass('public.office_themes') IS NULL
     OR to_regclass('public.tenant_bindings') IS NULL
     OR to_regclass('public.tenant_binding_history') IS NULL
     OR to_regclass('public.tenant_audit_archive') IS NULL THEN
    RAISE EXCEPTION '055_platform_runtime_b2: POST_APPLY_READINESS_FAILED — tables missing';
  END IF;
  IF to_regclass('public.idx_tenant_audit_user') IS NULL
     OR to_regclass('public.idx_tenant_audit_time') IS NULL
     OR to_regclass('public.idx_tenant_audit_source') IS NULL
     OR to_regclass('public.idx_ois_office') IS NULL
     OR to_regclass('public.idx_ir_status') IS NULL
     OR to_regclass('public.idx_tb_user') IS NULL
     OR to_regclass('public.idx_tbh_user') IS NULL
     OR to_regclass('public.idx_tbh_version') IS NULL
     OR to_regclass('public.idx_taa_tenant_period') IS NULL THEN
    RAISE EXCEPTION '055_platform_runtime_b2: POST_APPLY_READINESS_FAILED — indexes missing';
  END IF;
  RAISE NOTICE '055_platform_runtime_b2: post-apply FULL READY (reason=PLATFORM_RUNTIME_B2_SCHEMA_READY)';
END $$;

COMMIT;
