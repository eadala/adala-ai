-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 049: HR Performance Runtime DDL schema authority (Stage 8)
--
-- Owns the former Runtime CREATE from hrPerformance.ensureTables, corrected
-- to the proven live DML contract:
--   A) performance_evaluations (+ office_id TEXT NOT NULL from INSERT DML)
--   B) employee_incentives (+ office_id TEXT NOT NULL from INSERT DML)
--   C) hr_settings (+ exact UNIQUE(key) for ON CONFLICT (key))
--
-- Runtime CREATE omitted office_id while INSERT/readers require it.
-- No invented FK / UNIQUE / index beyond proven contract.
-- Extra live columns are never dropped or rewritten.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS performance_evaluations (
  id                  SERIAL PRIMARY KEY,
  office_id           TEXT NOT NULL,
  employee_id         TEXT NOT NULL,
  period              TEXT NOT NULL,
  cases_closed        INTEGER NOT NULL DEFAULT 0,
  cases_delayed       INTEGER NOT NULL DEFAULT 0,
  tasks_completed     INTEGER NOT NULL DEFAULT 0,
  errors              INTEGER NOT NULL DEFAULT 0,
  on_time_days        INTEGER NOT NULL DEFAULT 0,
  late_days           INTEGER NOT NULL DEFAULT 0,
  absent_days         INTEGER NOT NULL DEFAULT 0,
  clients_handled     INTEGER NOT NULL DEFAULT 0,
  data_errors         INTEGER NOT NULL DEFAULT 0,
  ops_handled         INTEGER NOT NULL DEFAULT 0,
  incidents_resolved  INTEGER NOT NULL DEFAULT 0,
  system_errors       INTEGER NOT NULL DEFAULT 0,
  role                TEXT NOT NULL DEFAULT 'lawyer',
  performance_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  evaluator_id        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_incentives (
  id          SERIAL PRIMARY KEY,
  office_id   TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'bonus',
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason      TEXT NOT NULL DEFAULT '',
  period      TEXT,
  is_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_settings (
  id   SERIAL PRIMARY KEY,
  key  TEXT UNIQUE NOT NULL,
  val  TEXT NOT NULL
);

ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS cases_closed INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS cases_delayed INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS tasks_completed INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS errors INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS on_time_days INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS late_days INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS absent_days INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS clients_handled INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS data_errors INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS ops_handled INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS incidents_resolved INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS system_errors INTEGER;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS performance_score NUMERIC(5,2);
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS evaluator_id TEXT;
ALTER TABLE performance_evaluations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);
ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS is_applied BOOLEAN;
ALTER TABLE employee_incentives ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE hr_settings ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE hr_settings ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE hr_settings ADD COLUMN IF NOT EXISTS val TEXT;

-- Legacy Runtime tables lacked office_id; backfill only from matching employees.
DO $$
BEGIN
  IF to_regclass('public.employees') IS NOT NULL THEN
    UPDATE performance_evaluations pe
    SET office_id = e.office_id
    FROM employees e
    WHERE pe.office_id IS NULL
      AND pe.employee_id = e.id::text
      AND e.office_id IS NOT NULL;

    UPDATE employee_incentives ei
    SET office_id = e.office_id
    FROM employees e
    WHERE ei.office_id IS NULL
      AND ei.employee_id = e.id::text
      AND e.office_id IS NOT NULL;
  END IF;
END $$;

DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('performance_evaluations','id','int4'),
      ('performance_evaluations','office_id','text'),
      ('performance_evaluations','employee_id','text'),
      ('performance_evaluations','period','text'),
      ('performance_evaluations','cases_closed','int4'),
      ('performance_evaluations','cases_delayed','int4'),
      ('performance_evaluations','tasks_completed','int4'),
      ('performance_evaluations','errors','int4'),
      ('performance_evaluations','on_time_days','int4'),
      ('performance_evaluations','late_days','int4'),
      ('performance_evaluations','absent_days','int4'),
      ('performance_evaluations','clients_handled','int4'),
      ('performance_evaluations','data_errors','int4'),
      ('performance_evaluations','ops_handled','int4'),
      ('performance_evaluations','incidents_resolved','int4'),
      ('performance_evaluations','system_errors','int4'),
      ('performance_evaluations','role','text'),
      ('performance_evaluations','performance_score','numeric'),
      ('performance_evaluations','notes','text'),
      ('performance_evaluations','evaluator_id','text'),
      ('performance_evaluations','created_at','timestamptz'),
      ('employee_incentives','id','int4'),
      ('employee_incentives','office_id','text'),
      ('employee_incentives','employee_id','text'),
      ('employee_incentives','type','text'),
      ('employee_incentives','amount','numeric'),
      ('employee_incentives','reason','text'),
      ('employee_incentives','period','text'),
      ('employee_incentives','is_applied','bool'),
      ('employee_incentives','created_at','timestamptz'),
      ('hr_settings','id','int4'),
      ('hr_settings','key','text'),
      ('hr_settings','val','text')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name=spec.table_name
      AND c.column_name=spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM performance_evaluations
  WHERE id IS NULL OR office_id IS NULL OR employee_id IS NULL OR period IS NULL
    OR cases_closed IS NULL OR cases_delayed IS NULL OR tasks_completed IS NULL OR errors IS NULL
    OR on_time_days IS NULL OR late_days IS NULL OR absent_days IS NULL
    OR clients_handled IS NULL OR data_errors IS NULL OR ops_handled IS NULL
    OR incidents_resolved IS NULL OR system_errors IS NULL OR role IS NULL
    OR performance_score IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — performance_evaluations has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM employee_incentives
  WHERE id IS NULL OR office_id IS NULL OR employee_id IS NULL OR type IS NULL
    OR amount IS NULL OR reason IS NULL OR is_applied IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — employee_incentives has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM hr_settings
  WHERE id IS NULL OR key IS NULL OR val IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — hr_settings has % NULL required row(s)',
      null_cnt;
  END IF;
END $$;

DO $$
DECLARE
  spec RECORD;
  seq_name TEXT;
  max_id BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('performance_evaluations','id'),
      ('employee_incentives','id'),
      ('hr_settings','id')
    ) AS t(table_name, column_name)
  LOOP
    seq_name := format('%s_%s_seq', spec.table_name, spec.column_name);
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I', seq_name);
    EXECUTE format('ALTER SEQUENCE public.%I OWNED BY public.%I.%I', seq_name, spec.table_name, spec.column_name);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT nextval(%L::regclass)',
      spec.table_name, spec.column_name, 'public.' || seq_name
    );
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM public.%I', spec.column_name, spec.table_name) INTO max_id;
    EXECUTE format('SELECT setval(%L::regclass, %s, %s)',
      'public.' || seq_name,
      GREATEST(max_id, 1),
      CASE WHEN max_id > 0 THEN 'true' ELSE 'false' END);
  END LOOP;
END $$;

ALTER TABLE performance_evaluations ALTER COLUMN cases_closed SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN cases_delayed SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN tasks_completed SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN errors SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN on_time_days SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN late_days SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN absent_days SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN clients_handled SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN data_errors SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN ops_handled SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN incidents_resolved SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN system_errors SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN role SET DEFAULT 'lawyer';
ALTER TABLE performance_evaluations ALTER COLUMN performance_score SET DEFAULT 0;
ALTER TABLE performance_evaluations ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE employee_incentives ALTER COLUMN type SET DEFAULT 'bonus';
ALTER TABLE employee_incentives ALTER COLUMN amount SET DEFAULT 0;
ALTER TABLE employee_incentives ALTER COLUMN reason SET DEFAULT '';
ALTER TABLE employee_incentives ALTER COLUMN is_applied SET DEFAULT FALSE;
ALTER TABLE employee_incentives ALTER COLUMN created_at SET DEFAULT NOW();

DO $$
BEGIN
  ALTER TABLE performance_evaluations ALTER COLUMN id SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN employee_id SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN period SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN cases_closed SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN cases_delayed SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN tasks_completed SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN errors SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN on_time_days SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN late_days SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN absent_days SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN clients_handled SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN data_errors SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN ops_handled SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN incidents_resolved SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN system_errors SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN role SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN performance_score SET NOT NULL;
  ALTER TABLE performance_evaluations ALTER COLUMN created_at SET NOT NULL;

  ALTER TABLE employee_incentives ALTER COLUMN id SET NOT NULL;
  ALTER TABLE employee_incentives ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE employee_incentives ALTER COLUMN employee_id SET NOT NULL;
  ALTER TABLE employee_incentives ALTER COLUMN type SET NOT NULL;
  ALTER TABLE employee_incentives ALTER COLUMN amount SET NOT NULL;
  ALTER TABLE employee_incentives ALTER COLUMN reason SET NOT NULL;
  ALTER TABLE employee_incentives ALTER COLUMN is_applied SET NOT NULL;
  ALTER TABLE employee_incentives ALTER COLUMN created_at SET NOT NULL;

  ALTER TABLE hr_settings ALTER COLUMN id SET NOT NULL;
  ALTER TABLE hr_settings ALTER COLUMN key SET NOT NULL;
  ALTER TABLE hr_settings ALTER COLUMN val SET NOT NULL;
END $$;

DO $$
DECLARE
  tbl TEXT;
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['performance_evaluations','employee_incentives','hr_settings']::TEXT[] LOOP
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
          '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format(
        $q$SELECT COUNT(*) FROM (
             SELECT id FROM public.%I WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
           ) d$q$, tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=to_regclass(format('public.%I', tbl)) AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION
        '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  dup_cnt BIGINT;
  uq_rec RECORD;
  approved_unique_found BOOLEAN := FALSE;
  has_incompatible_unique BOOLEAN := FALSE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index x
    WHERE x.indrelid='public.hr_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (
        x.indpred IS NOT NULL
        OR x.indexprs IS NOT NULL
        OR x.indisvalid IS DISTINCT FROM TRUE
        OR x.indisready IS DISTINCT FROM TRUE
      )
  ) THEN
    RAISE EXCEPTION
      '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — hr_settings UNIQUE index invalid/not-ready/partial/expression';
  END IF;

  FOR uq_rec IN
    SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
    FROM pg_index x
    CROSS JOIN LATERAL unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
    WHERE x.indrelid='public.hr_settings'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisvalid AND x.indisready
    GROUP BY x.indexrelid
  LOOP
    IF uq_rec.cols IS DISTINCT FROM ARRAY['key']::TEXT[] THEN
      has_incompatible_unique := TRUE;
    ELSE
      approved_unique_found := TRUE;
    END IF;
  END LOOP;

  IF has_incompatible_unique THEN
    RAISE EXCEPTION
      '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — hr_settings has incompatible UNIQUE index(es); require exactly UNIQUE(key)';
  END IF;

  IF NOT approved_unique_found THEN
    SELECT COUNT(*) INTO dup_cnt
    FROM (
      SELECT key
      FROM hr_settings
      WHERE key IS NOT NULL
      GROUP BY key
      HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION
        '049_hr_performance: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — hr_settings has % duplicate key group(s)',
        dup_cnt;
    END IF;
    ALTER TABLE hr_settings
      ADD CONSTRAINT hr_settings_key_key
      UNIQUE (key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='performance_evaluations' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '049_hr_performance: POST_APPLY_READINESS_FAILED — performance_evaluations.office_id TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='employee_incentives' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '049_hr_performance: POST_APPLY_READINESS_FAILED — employee_incentives.office_id TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.hr_settings'::regclass
      AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*key\s*\)'
      AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,'
  ) THEN
    RAISE EXCEPTION '049_hr_performance: POST_APPLY_READINESS_FAILED — hr_settings UNIQUE(key) missing';
  END IF;

  RAISE NOTICE '049_hr_performance: post-apply FULL READY (reason=HR_PERFORMANCE_SCHEMA_READY; performance_evaluations.office_id; employee_incentives.office_id; hr_settings UNIQUE(key))';
END $$;

COMMIT;
