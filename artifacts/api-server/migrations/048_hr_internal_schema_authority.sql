-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 048: HR Internal Runtime DDL schema authority (Stage 8)
--
-- Owns the former Runtime CREATE from hrInternal.ensureTables:
--   A) hr_announcements
--   B) employee_requests
--   C) leave_balances (+ exact UNIQUE(employee_id, leave_type, year))
--
-- Production verification confirmed these tables are absent, but 048 remains
-- idempotent / legacy-safe for partial compatible schemas.
-- No invented FK / UNIQUE / index beyond exact Runtime contract.
-- Extra live columns are never dropped or rewritten.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS hr_announcements (
  id          SERIAL PRIMARY KEY,
  office_id   TEXT NOT NULL DEFAULT 'default',
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal',
  target_dept TEXT,
  author_name TEXT,
  author_id   TEXT,
  expires_at  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_requests (
  id           SERIAL PRIMARY KEY,
  office_id    TEXT NOT NULL DEFAULT 'default',
  employee_id  TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'document',
  subject      TEXT NOT NULL,
  body         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  response     TEXT,
  resolved_by  TEXT,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id          SERIAL PRIMARY KEY,
  office_id   TEXT NOT NULL DEFAULT 'default',
  employee_id TEXT NOT NULL,
  leave_type  TEXT NOT NULL DEFAULT 'annual',
  year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::int,
  quota       INTEGER NOT NULL DEFAULT 21,
  used        INTEGER NOT NULL DEFAULT 0,
  UNIQUE(employee_id, leave_type, year)
);

ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS target_dept TEXT;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS author_id TEXT;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS expires_at DATE;
ALTER TABLE hr_announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE employee_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS id INTEGER;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS leave_type TEXT;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS quota INTEGER;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS used INTEGER;

DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('hr_announcements','id','int4'),
      ('hr_announcements','office_id','text'),
      ('hr_announcements','title','text'),
      ('hr_announcements','content','text'),
      ('hr_announcements','priority','text'),
      ('hr_announcements','target_dept','text'),
      ('hr_announcements','author_name','text'),
      ('hr_announcements','author_id','text'),
      ('hr_announcements','expires_at','date'),
      ('hr_announcements','created_at','timestamptz'),
      ('employee_requests','id','int4'),
      ('employee_requests','office_id','text'),
      ('employee_requests','employee_id','text'),
      ('employee_requests','type','text'),
      ('employee_requests','subject','text'),
      ('employee_requests','body','text'),
      ('employee_requests','status','text'),
      ('employee_requests','response','text'),
      ('employee_requests','resolved_by','text'),
      ('employee_requests','resolved_at','timestamptz'),
      ('employee_requests','created_at','timestamptz'),
      ('leave_balances','id','int4'),
      ('leave_balances','office_id','text'),
      ('leave_balances','employee_id','text'),
      ('leave_balances','leave_type','text'),
      ('leave_balances','year','int4'),
      ('leave_balances','quota','int4'),
      ('leave_balances','used','int4')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name=spec.table_name
      AND c.column_name=spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM hr_announcements
  WHERE id IS NULL OR office_id IS NULL OR title IS NULL OR content IS NULL
    OR priority IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — hr_announcements has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM employee_requests
  WHERE id IS NULL OR office_id IS NULL OR employee_id IS NULL OR type IS NULL
    OR subject IS NULL OR status IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — employee_requests has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM leave_balances
  WHERE id IS NULL OR office_id IS NULL OR employee_id IS NULL OR leave_type IS NULL
    OR year IS NULL OR quota IS NULL OR used IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — leave_balances has % NULL required row(s)',
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
      ('hr_announcements','id'),
      ('employee_requests','id'),
      ('leave_balances','id')
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

ALTER TABLE hr_announcements ALTER COLUMN office_id SET DEFAULT 'default';
ALTER TABLE hr_announcements ALTER COLUMN priority SET DEFAULT 'normal';
ALTER TABLE hr_announcements ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE employee_requests ALTER COLUMN office_id SET DEFAULT 'default';
ALTER TABLE employee_requests ALTER COLUMN type SET DEFAULT 'document';
ALTER TABLE employee_requests ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE employee_requests ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE leave_balances ALTER COLUMN office_id SET DEFAULT 'default';
ALTER TABLE leave_balances ALTER COLUMN leave_type SET DEFAULT 'annual';
ALTER TABLE leave_balances ALTER COLUMN year SET DEFAULT EXTRACT(YEAR FROM NOW())::int;
ALTER TABLE leave_balances ALTER COLUMN quota SET DEFAULT 21;
ALTER TABLE leave_balances ALTER COLUMN used SET DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE hr_announcements ALTER COLUMN id SET NOT NULL;
  ALTER TABLE hr_announcements ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE hr_announcements ALTER COLUMN title SET NOT NULL;
  ALTER TABLE hr_announcements ALTER COLUMN content SET NOT NULL;
  ALTER TABLE hr_announcements ALTER COLUMN priority SET NOT NULL;
  ALTER TABLE hr_announcements ALTER COLUMN created_at SET NOT NULL;

  ALTER TABLE employee_requests ALTER COLUMN id SET NOT NULL;
  ALTER TABLE employee_requests ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE employee_requests ALTER COLUMN employee_id SET NOT NULL;
  ALTER TABLE employee_requests ALTER COLUMN type SET NOT NULL;
  ALTER TABLE employee_requests ALTER COLUMN subject SET NOT NULL;
  ALTER TABLE employee_requests ALTER COLUMN status SET NOT NULL;
  ALTER TABLE employee_requests ALTER COLUMN created_at SET NOT NULL;

  ALTER TABLE leave_balances ALTER COLUMN id SET NOT NULL;
  ALTER TABLE leave_balances ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE leave_balances ALTER COLUMN employee_id SET NOT NULL;
  ALTER TABLE leave_balances ALTER COLUMN leave_type SET NOT NULL;
  ALTER TABLE leave_balances ALTER COLUMN year SET NOT NULL;
  ALTER TABLE leave_balances ALTER COLUMN quota SET NOT NULL;
  ALTER TABLE leave_balances ALTER COLUMN used SET NOT NULL;
END $$;

DO $$
DECLARE
  tbl TEXT;
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['hr_announcements','employee_requests','leave_balances']::TEXT[] LOOP
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
          '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format(
        $q$SELECT COUNT(*) FROM (
             SELECT id FROM public.%I WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
           ) d$q$, tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=to_regclass(format('public.%I', tbl)) AND c.contype='p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION
        '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
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
    WHERE x.indrelid='public.leave_balances'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND (
        x.indpred IS NOT NULL
        OR x.indexprs IS NOT NULL
        OR x.indisvalid IS DISTINCT FROM TRUE
        OR x.indisready IS DISTINCT FROM TRUE
      )
  ) THEN
    RAISE EXCEPTION
      '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — leave_balances UNIQUE index invalid/not-ready/partial/expression';
  END IF;

  FOR uq_rec IN
    SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS cols
    FROM pg_index x
    CROSS JOIN LATERAL unnest(x.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid=x.indrelid AND a.attnum=k.attnum AND NOT a.attisdropped
    WHERE x.indrelid='public.leave_balances'::regclass
      AND x.indisunique AND NOT x.indisprimary
      AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisvalid AND x.indisready
    GROUP BY x.indexrelid
  LOOP
    IF uq_rec.cols IS DISTINCT FROM ARRAY['employee_id','leave_type','year']::TEXT[] THEN
      has_incompatible_unique := TRUE;
    ELSE
      approved_unique_found := TRUE;
    END IF;
  END LOOP;

  IF has_incompatible_unique THEN
    RAISE EXCEPTION
      '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_UNIQUE) — leave_balances has incompatible UNIQUE index(es); require exactly UNIQUE(employee_id, leave_type, year)';
  END IF;

  IF NOT approved_unique_found THEN
    SELECT COUNT(*) INTO dup_cnt
    FROM (
      SELECT employee_id, leave_type, year
      FROM leave_balances
      GROUP BY employee_id, leave_type, year
      HAVING COUNT(*) > 1
    ) d;
    IF dup_cnt > 0 THEN
      RAISE EXCEPTION
        '048_hr_internal: BLOCK_AND_MANUAL_REVIEW (reason_code=DUPLICATE_UNIQUE_KEY) — leave_balances has % duplicate (employee_id, leave_type, year) group(s)',
        dup_cnt;
    END IF;
    ALTER TABLE leave_balances
      ADD CONSTRAINT leave_balances_employee_id_leave_type_year_key
      UNIQUE (employee_id, leave_type, year);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hr_announcements' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '048_hr_internal: POST_APPLY_READINESS_FAILED — hr_announcements.office_id TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='employee_requests' AND column_name='employee_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '048_hr_internal: POST_APPLY_READINESS_FAILED — employee_requests.employee_id TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leave_balances' AND column_name='leave_type'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '048_hr_internal: POST_APPLY_READINESS_FAILED — leave_balances.leave_type TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.leave_balances'::regclass
      AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ~* 'UNIQUE\s*\(\s*employee_id\s*,\s*leave_type\s*,\s*year\s*\)'
      AND pg_get_constraintdef(c.oid) !~* 'UNIQUE\s*\([^)]*,[^)]*,[^)]*,'
  ) THEN
    RAISE EXCEPTION '048_hr_internal: POST_APPLY_READINESS_FAILED — leave_balances UNIQUE(employee_id, leave_type, year) missing';
  END IF;

  RAISE NOTICE '048_hr_internal: post-apply FULL READY (reason=HR_INTERNAL_SCHEMA_READY; hr_announcements; employee_requests; leave_balances UNIQUE(employee_id, leave_type, year))';
END $$;

COMMIT;
