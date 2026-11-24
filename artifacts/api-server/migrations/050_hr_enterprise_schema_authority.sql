-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 050: HR Enterprise Runtime DDL schema authority (Stage 8)
--
-- Owns former Runtime CREATE/INDEX from ensureHREnterpriseTables:
--   A) hr_roles          (+ exact UNIQUE(office_id, name) for ON CONFLICT)
--   B) hr_memberships    (+ exact UNIQUE(office_id, user_id) for ON CONFLICT)
--   C) hr_workflows      (+ idx_hrwf_office (office_id, status))
--   D) hr_audit_logs     (+ idx_hral_office (office_id, created_at DESC))
--
-- Contract = proven Runtime CREATE + live DML (authorize/seed/ON CONFLICT).
-- No invented FK. Extra live columns never dropped/rewritten.
-- Idempotent. Fail-closed. No DROP TABLE / DROP INDEX.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS hr_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  name         TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description  TEXT,
  scope        TEXT NOT NULL DEFAULT 'tenant',
  hierarchy    INT  NOT NULL DEFAULT 5,
  is_system    BOOLEAN DEFAULT FALSE,
  permissions  JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, name)
);

CREATE TABLE IF NOT EXISTS hr_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  employee_id UUID,
  role_name   TEXT NOT NULL DEFAULT 'lawyer',
  status      TEXT NOT NULL DEFAULT 'active',
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, user_id)
);

CREATE TABLE IF NOT EXISTS hr_workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       TEXT NOT NULL,
  type            TEXT NOT NULL,
  requester_id    TEXT NOT NULL,
  requester_name  TEXT,
  approver_id     TEXT,
  approver_name   TEXT,
  subject_user_id TEXT,
  subject_name    TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending',
  priority        TEXT NOT NULL DEFAULT 'normal',
  notes           TEXT,
  reviewed_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id    TEXT NOT NULL,
  user_id      TEXT,
  user_name    TEXT,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  target_name  TEXT,
  old_value    JSONB,
  new_value    JSONB,
  severity     TEXT DEFAULT 'low',
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS hierarchy INT;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS permissions JSONB;
ALTER TABLE hr_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE hr_memberships ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE hr_memberships ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE hr_memberships ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE hr_memberships ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE hr_memberships ADD COLUMN IF NOT EXISTS role_name TEXT;
ALTER TABLE hr_memberships ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE hr_memberships ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ;
ALTER TABLE hr_memberships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS requester_id TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS requester_name TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS approver_id TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS approver_name TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS subject_user_id TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS subject_name TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE hr_workflows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS target_name TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE hr_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('hr_roles','id','uuid'),
      ('hr_roles','office_id','text'),
      ('hr_roles','name','text'),
      ('hr_roles','display_name','text'),
      ('hr_roles','description','text'),
      ('hr_roles','scope','text'),
      ('hr_roles','hierarchy','int4'),
      ('hr_roles','is_system','bool'),
      ('hr_roles','permissions','jsonb'),
      ('hr_roles','created_at','timestamptz'),
      ('hr_memberships','id','uuid'),
      ('hr_memberships','office_id','text'),
      ('hr_memberships','user_id','text'),
      ('hr_memberships','employee_id','uuid'),
      ('hr_memberships','role_name','text'),
      ('hr_memberships','status','text'),
      ('hr_memberships','joined_at','timestamptz'),
      ('hr_memberships','updated_at','timestamptz'),
      ('hr_workflows','id','uuid'),
      ('hr_workflows','office_id','text'),
      ('hr_workflows','type','text'),
      ('hr_workflows','requester_id','text'),
      ('hr_workflows','requester_name','text'),
      ('hr_workflows','approver_id','text'),
      ('hr_workflows','approver_name','text'),
      ('hr_workflows','subject_user_id','text'),
      ('hr_workflows','subject_name','text'),
      ('hr_workflows','payload','jsonb'),
      ('hr_workflows','status','text'),
      ('hr_workflows','priority','text'),
      ('hr_workflows','notes','text'),
      ('hr_workflows','reviewed_at','timestamptz'),
      ('hr_workflows','expires_at','timestamptz'),
      ('hr_workflows','created_at','timestamptz'),
      ('hr_workflows','updated_at','timestamptz'),
      ('hr_audit_logs','id','uuid'),
      ('hr_audit_logs','office_id','text'),
      ('hr_audit_logs','user_id','text'),
      ('hr_audit_logs','user_name','text'),
      ('hr_audit_logs','action','text'),
      ('hr_audit_logs','target_type','text'),
      ('hr_audit_logs','target_id','text'),
      ('hr_audit_logs','target_name','text'),
      ('hr_audit_logs','old_value','jsonb'),
      ('hr_audit_logs','new_value','jsonb'),
      ('hr_audit_logs','severity','text'),
      ('hr_audit_logs','ip_address','text'),
      ('hr_audit_logs','created_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name=spec.table_name
      AND c.column_name=spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM hr_roles
  WHERE id IS NULL OR office_id IS NULL OR name IS NULL OR display_name IS NULL
    OR scope IS NULL OR hierarchy IS NULL OR permissions IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — hr_roles has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM hr_memberships
  WHERE id IS NULL OR office_id IS NULL OR user_id IS NULL OR role_name IS NULL OR status IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — hr_memberships has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM hr_workflows
  WHERE id IS NULL OR office_id IS NULL OR type IS NULL OR requester_id IS NULL
    OR payload IS NULL OR status IS NULL OR priority IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — hr_workflows has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM hr_audit_logs
  WHERE id IS NULL OR office_id IS NULL OR action IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — hr_audit_logs has % NULL required row(s)',
      null_cnt;
  END IF;
END $$;

ALTER TABLE hr_roles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE hr_roles ALTER COLUMN scope SET DEFAULT 'tenant';
ALTER TABLE hr_roles ALTER COLUMN hierarchy SET DEFAULT 5;
ALTER TABLE hr_roles ALTER COLUMN is_system SET DEFAULT FALSE;
ALTER TABLE hr_roles ALTER COLUMN permissions SET DEFAULT '[]';
ALTER TABLE hr_roles ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE hr_memberships ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE hr_memberships ALTER COLUMN role_name SET DEFAULT 'lawyer';
ALTER TABLE hr_memberships ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE hr_memberships ALTER COLUMN joined_at SET DEFAULT NOW();
ALTER TABLE hr_memberships ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE hr_workflows ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE hr_workflows ALTER COLUMN payload SET DEFAULT '{}';
ALTER TABLE hr_workflows ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE hr_workflows ALTER COLUMN priority SET DEFAULT 'normal';
ALTER TABLE hr_workflows ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE hr_workflows ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE hr_audit_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE hr_audit_logs ALTER COLUMN severity SET DEFAULT 'low';
ALTER TABLE hr_audit_logs ALTER COLUMN created_at SET DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE hr_roles ALTER COLUMN id SET NOT NULL;
  ALTER TABLE hr_roles ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE hr_roles ALTER COLUMN name SET NOT NULL;
  ALTER TABLE hr_roles ALTER COLUMN display_name SET NOT NULL;
  ALTER TABLE hr_roles ALTER COLUMN scope SET NOT NULL;
  ALTER TABLE hr_roles ALTER COLUMN hierarchy SET NOT NULL;
  ALTER TABLE hr_roles ALTER COLUMN permissions SET NOT NULL;

  ALTER TABLE hr_memberships ALTER COLUMN id SET NOT NULL;
  ALTER TABLE hr_memberships ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE hr_memberships ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE hr_memberships ALTER COLUMN role_name SET NOT NULL;
  ALTER TABLE hr_memberships ALTER COLUMN status SET NOT NULL;

  ALTER TABLE hr_workflows ALTER COLUMN id SET NOT NULL;
  ALTER TABLE hr_workflows ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE hr_workflows ALTER COLUMN type SET NOT NULL;
  ALTER TABLE hr_workflows ALTER COLUMN requester_id SET NOT NULL;
  ALTER TABLE hr_workflows ALTER COLUMN payload SET NOT NULL;
  ALTER TABLE hr_workflows ALTER COLUMN status SET NOT NULL;
  ALTER TABLE hr_workflows ALTER COLUMN priority SET NOT NULL;

  ALTER TABLE hr_audit_logs ALTER COLUMN id SET NOT NULL;
  ALTER TABLE hr_audit_logs ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE hr_audit_logs ALTER COLUMN action SET NOT NULL;
END $$;

DO $$
DECLARE
  tbl TEXT;
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['hr_roles','hr_memberships','hr_workflows','hr_audit_logs']::TEXT[] LOOP
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
          '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format(
        $q$SELECT COUNT(*) FROM (
             SELECT id FROM public.%I WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
           ) d$q$, tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=to_regclass(format('public.%I', tbl)) AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION
        '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

-- Exact UNIQUE(office_id, name) on hr_roles — inspect ALL non-primary uniques
DO $$
DECLARE
  dup_cnt BIGINT;
  uq_rec RECORD;
  approved_unique_found BOOLEAN := FALSE;
  has_incompatible_unique BOOLEAN := FALSE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.hr_roles'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (
        x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
        OR x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
      )
  ) THEN
    RAISE EXCEPTION
      '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — hr_roles UNIQUE index invalid/not-ready/partial/expression';
  END IF;

  FOR uq_rec IN
    SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
    FROM pg_index x
    CROSS JOIN LATERAL unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
    WHERE x.indrelid='public.hr_roles'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisvalid AND x.indisready
    GROUP BY x.indexrelid
  LOOP
    IF uq_rec.cols IS DISTINCT FROM ARRAY['office_id','name']::TEXT[] THEN
      has_incompatible_unique := TRUE;
    ELSE
      approved_unique_found := TRUE;
    END IF;
  END LOOP;

  IF has_incompatible_unique THEN
    RAISE EXCEPTION
      '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — hr_roles has incompatible UNIQUE index(es); require exactly UNIQUE(office_id, name)';
  END IF;

  IF NOT approved_unique_found THEN
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT office_id, name FROM hr_roles
      WHERE office_id IS NOT NULL AND name IS NOT NULL
      GROUP BY office_id, name HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION
        '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — hr_roles has % duplicate (office_id, name) group(s)',
        dup_cnt;
    END IF;
    ALTER TABLE hr_roles ADD CONSTRAINT hr_roles_office_id_name_key UNIQUE (office_id, name);
  END IF;
END $$;

-- Exact UNIQUE(office_id, user_id) on hr_memberships — inspect ALL non-primary uniques
DO $$
DECLARE
  dup_cnt BIGINT;
  uq_rec RECORD;
  approved_unique_found BOOLEAN := FALSE;
  has_incompatible_unique BOOLEAN := FALSE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.hr_memberships'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (
        x.indpred IS NOT NULL OR x.indexprs IS NOT NULL
        OR x.indisvalid IS DISTINCT FROM TRUE OR x.indisready IS DISTINCT FROM TRUE
      )
  ) THEN
    RAISE EXCEPTION
      '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — hr_memberships UNIQUE index invalid/not-ready/partial/expression';
  END IF;

  FOR uq_rec IN
    SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
    FROM pg_index x
    CROSS JOIN LATERAL unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
    WHERE x.indrelid='public.hr_memberships'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisvalid AND x.indisready
    GROUP BY x.indexrelid
  LOOP
    IF uq_rec.cols IS DISTINCT FROM ARRAY['office_id','user_id']::TEXT[] THEN
      has_incompatible_unique := TRUE;
    ELSE
      approved_unique_found := TRUE;
    END IF;
  END LOOP;

  IF has_incompatible_unique THEN
    RAISE EXCEPTION
      '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — hr_memberships has incompatible UNIQUE index(es); require exactly UNIQUE(office_id, user_id)';
  END IF;

  IF NOT approved_unique_found THEN
    SELECT COUNT(*) INTO dup_cnt FROM (
      SELECT office_id, user_id FROM hr_memberships
      WHERE office_id IS NOT NULL AND user_id IS NOT NULL
      GROUP BY office_id, user_id HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION
        '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — hr_memberships has % duplicate (office_id, user_id) group(s)',
        dup_cnt;
    END IF;
    ALTER TABLE hr_memberships ADD CONSTRAINT hr_memberships_office_id_user_id_key UNIQUE (office_id, user_id);
  END IF;
END $$;

-- idx_hrwf_office (office_id, status) ASC/ASC non-unique
DO $$
DECLARE
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
  expected_table_oid := to_regclass('public.hr_workflows');
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
  WHERE n.nspname='public' AND i.relname='idx_hrwf_office';

  IF FOUND THEN
    desc_ok := true;
    IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM 2 THEN
      desc_ok := false;
    ELSE
      FOR opt_i IN 1 .. 2 LOOP
        IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
      END LOOP;
    END IF;
    IF actual_table_oid IS DISTINCT FROM expected_table_oid
       OR index_unique IS DISTINCT FROM FALSE
       OR index_partial IS DISTINCT FROM FALSE
       OR index_expression IS DISTINCT FROM FALSE
       OR index_valid IS DISTINCT FROM TRUE
       OR index_ready IS DISTINCT FROM TRUE
       OR index_columns IS DISTINCT FROM ARRAY['office_id','status']::text[]
       OR desc_ok IS NOT TRUE THEN
      RAISE EXCEPTION
        '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_hrwf_office incompatible (cols=% opts=%). No DROP INDEX.',
        index_columns, index_options;
    END IF;
  ELSE
    IF expected_table_oid IS NULL THEN
      RAISE EXCEPTION
        '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — idx_hrwf_office needs hr_workflows';
    END IF;
    CREATE INDEX IF NOT EXISTS idx_hrwf_office ON hr_workflows (office_id, status);
  END IF;
END $$;

-- idx_hral_office (office_id ASC, created_at DESC) non-unique
DO $$
DECLARE
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
BEGIN
  expected_table_oid := to_regclass('public.hr_audit_logs');
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
  WHERE n.nspname='public' AND i.relname='idx_hral_office';

  IF FOUND THEN
    desc_ok := true;
    IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM 2 THEN
      desc_ok := false;
    ELSE
      IF (index_options[1] & 1) IS DISTINCT FROM 0 THEN desc_ok := false; END IF;
      IF (index_options[2] & 1) IS DISTINCT FROM 1 THEN desc_ok := false; END IF;
    END IF;
    IF actual_table_oid IS DISTINCT FROM expected_table_oid
       OR index_unique IS DISTINCT FROM FALSE
       OR index_partial IS DISTINCT FROM FALSE
       OR index_expression IS DISTINCT FROM FALSE
       OR index_valid IS DISTINCT FROM TRUE
       OR index_ready IS DISTINCT FROM TRUE
       OR index_columns IS DISTINCT FROM ARRAY['office_id','created_at']::text[]
       OR desc_ok IS NOT TRUE THEN
      RAISE EXCEPTION
        '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — idx_hral_office incompatible (cols=% opts=%). No DROP INDEX.',
        index_columns, index_options;
    END IF;
  ELSE
    IF expected_table_oid IS NULL THEN
      RAISE EXCEPTION
        '050_hr_enterprise: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — idx_hral_office needs hr_audit_logs';
    END IF;
    CREATE INDEX IF NOT EXISTS idx_hral_office ON hr_audit_logs (office_id, created_at DESC);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hr_roles' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '050_hr_enterprise: POST_APPLY_READINESS_FAILED — hr_roles.office_id TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.hr_roles'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*,\s*name\s*\)'
      AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,[^)]*,'
  ) THEN
    RAISE EXCEPTION '050_hr_enterprise: POST_APPLY_READINESS_FAILED — hr_roles UNIQUE(office_id, name) missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.hr_memberships'::regclass AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*office_id\s*,\s*user_id\s*\)'
      AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,[^)]*,'
  ) THEN
    RAISE EXCEPTION '050_hr_enterprise: POST_APPLY_READINESS_FAILED — hr_memberships UNIQUE(office_id, user_id) missing';
  END IF;
  IF to_regclass('public.idx_hrwf_office') IS NULL OR to_regclass('public.idx_hral_office') IS NULL THEN
    RAISE EXCEPTION '050_hr_enterprise: POST_APPLY_READINESS_FAILED — required indexes missing';
  END IF;

  RAISE NOTICE '050_hr_enterprise: post-apply FULL READY (reason=HR_ENTERPRISE_SCHEMA_READY; hr_roles UNIQUE(office_id,name); hr_memberships UNIQUE(office_id,user_id); idx_hrwf_office; idx_hral_office)';
END $$;

COMMIT;
