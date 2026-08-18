-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 047: Calendar Runtime DDL schema authority (Stage 8)
--
-- Owns the still-executable Runtime CREATE from calendar.ensureTables:
--   A) events — TEXT PK id (exact Runtime CREATE)
--   B) event_reminders — TEXT PK id + FK event_id → events(id) ON DELETE CASCADE
--   C) idx_events_case_id ON events(case_id) ASC — non-unique, no predicate
--   D) idx_events_office_start ON events(office_id, start_at) ASC — non-unique, no predicate
--
-- Index names/shapes match Migration 020 (index-only, guarded if table missing).
-- 047 is table + FK authority; 020 is not rewritten. Greenfield: 020 skips
-- these indexes (events absent), then 047 creates tables and the same indexes.
--
-- Does NOT CREATE: HR Internal/Performance/Enterprise tables, office_notification_settings,
-- reminders, system_events, ai_events, 039–046 objects.
-- No invented UNIQUE. No invented FK on case_id / client_id / office_id / user_id.
-- office_id remains TEXT NOT NULL DEFAULT 'default' (no UUID-only / remap / backfill).
-- Extra live columns are never dropped or rewritten.
--
-- Idempotent. No DROP TABLE / DROP INDEX. Fail-closed.
-- Post-apply readiness before COMMIT.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A) events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  office_id    TEXT NOT NULL DEFAULT 'default',
  title        TEXT NOT NULL,
  event_type   TEXT NOT NULL DEFAULT 'other',
  start_at     TIMESTAMPTZ NOT NULL,
  end_at       TIMESTAMPTZ,
  all_day      BOOLEAN NOT NULL DEFAULT FALSE,
  case_id      TEXT,
  client_id    TEXT,
  location     TEXT,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'upcoming',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS office_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day BOOLEAN;
ALTER TABLE events ADD COLUMN IF NOT EXISTS case_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── B) event_reminders ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_reminders (
  id                     TEXT PRIMARY KEY,
  event_id               TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  notify_before_minutes  INTEGER NOT NULL DEFAULT 60,
  notification_type      TEXT NOT NULL DEFAULT 'email',
  email                  TEXT,
  sent                   BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS notify_before_minutes INTEGER;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS notification_type TEXT;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS sent BOOLEAN;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- Type validation + NULL required probes (owned columns only)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  spec RECORD;
  actual_udt TEXT;
  null_cnt BIGINT;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('events','id','text'),
      ('events','user_id','text'),
      ('events','office_id','text'),
      ('events','title','text'),
      ('events','event_type','text'),
      ('events','start_at','timestamptz'),
      ('events','end_at','timestamptz'),
      ('events','all_day','bool'),
      ('events','case_id','text'),
      ('events','client_id','text'),
      ('events','location','text'),
      ('events','description','text'),
      ('events','status','text'),
      ('events','created_at','timestamptz'),
      ('events','updated_at','timestamptz'),
      ('event_reminders','id','text'),
      ('event_reminders','event_id','text'),
      ('event_reminders','notify_before_minutes','int4'),
      ('event_reminders','notification_type','text'),
      ('event_reminders','email','text'),
      ('event_reminders','sent','bool'),
      ('event_reminders','sent_at','timestamptz'),
      ('event_reminders','created_at','timestamptz')
    ) AS t(table_name, column_name, udt_name)
  LOOP
    SELECT c.udt_name INTO actual_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = spec.table_name
      AND c.column_name = spec.column_name;
    IF actual_udt IS NULL OR actual_udt IS DISTINCT FROM spec.udt_name THEN
      RAISE EXCEPTION
        '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_TYPE) — %.% has udt %, expected %',
        spec.table_name, spec.column_name, coalesce(actual_udt, '<missing>'), spec.udt_name;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO null_cnt FROM events
  WHERE id IS NULL OR user_id IS NULL OR office_id IS NULL OR title IS NULL
    OR event_type IS NULL OR start_at IS NULL OR all_day IS NULL OR status IS NULL
    OR created_at IS NULL OR updated_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — events has % NULL required row(s)',
      null_cnt;
  END IF;

  SELECT COUNT(*) INTO null_cnt FROM event_reminders
  WHERE id IS NULL OR event_id IS NULL OR notify_before_minutes IS NULL
    OR notification_type IS NULL OR sent IS NULL OR created_at IS NULL;
  IF null_cnt > 0 THEN
    RAISE EXCEPTION
      '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — event_reminders has % NULL required row(s)',
      null_cnt;
  END IF;
END $$;

-- Safe defaults (exact Runtime)
ALTER TABLE events ALTER COLUMN office_id SET DEFAULT 'default';
ALTER TABLE events ALTER COLUMN event_type SET DEFAULT 'other';
ALTER TABLE events ALTER COLUMN all_day SET DEFAULT FALSE;
ALTER TABLE events ALTER COLUMN status SET DEFAULT 'upcoming';
ALTER TABLE events ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE events ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE event_reminders ALTER COLUMN notify_before_minutes SET DEFAULT 60;
ALTER TABLE event_reminders ALTER COLUMN notification_type SET DEFAULT 'email';
ALTER TABLE event_reminders ALTER COLUMN sent SET DEFAULT FALSE;
ALTER TABLE event_reminders ALTER COLUMN created_at SET DEFAULT NOW();

-- SET NOT NULL after NULL probes (exact Runtime NOT NULL set)
DO $$
BEGIN
  ALTER TABLE events ALTER COLUMN id SET NOT NULL;
  ALTER TABLE events ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE events ALTER COLUMN office_id SET NOT NULL;
  ALTER TABLE events ALTER COLUMN title SET NOT NULL;
  ALTER TABLE events ALTER COLUMN event_type SET NOT NULL;
  ALTER TABLE events ALTER COLUMN start_at SET NOT NULL;
  ALTER TABLE events ALTER COLUMN all_day SET NOT NULL;
  ALTER TABLE events ALTER COLUMN status SET NOT NULL;
  ALTER TABLE events ALTER COLUMN created_at SET NOT NULL;
  ALTER TABLE events ALTER COLUMN updated_at SET NOT NULL;

  ALTER TABLE event_reminders ALTER COLUMN id SET NOT NULL;
  ALTER TABLE event_reminders ALTER COLUMN event_id SET NOT NULL;
  ALTER TABLE event_reminders ALTER COLUMN notify_before_minutes SET NOT NULL;
  ALTER TABLE event_reminders ALTER COLUMN notification_type SET NOT NULL;
  ALTER TABLE event_reminders ALTER COLUMN sent SET NOT NULL;
  ALTER TABLE event_reminders ALTER COLUMN created_at SET NOT NULL;
END $$;

-- PK (id) on both tables
DO $$
DECLARE
  tbl TEXT;
  has_pk BOOLEAN;
  null_cnt BIGINT;
  dup_cnt BIGINT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['events','event_reminders']::TEXT[] LOOP
    EXECUTE format(
      $q$SELECT EXISTS (
           SELECT 1 FROM pg_constraint c
           WHERE c.conrelid = %L::regclass AND c.contype = 'p'
         )$q$, 'public.' || tbl)
      INTO has_pk;
    IF NOT has_pk THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE id IS NULL', tbl) INTO null_cnt;
      IF null_cnt > 0 THEN
        RAISE EXCEPTION
          '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=NULL_REQUIRED) — NULL id blocks PK on %', tbl;
      END IF;
      EXECUTE format(
        $q$SELECT COUNT(*) FROM (SELECT id FROM public.%I GROUP BY id HAVING COUNT(*) > 1) d$q$, tbl)
        INTO dup_cnt;
      IF dup_cnt > 0 THEN
        RAISE EXCEPTION
          '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — duplicate id blocks PK on %', tbl;
      END IF;
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', tbl)) AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) ~* '\(id\)'
        AND pg_get_constraintdef(c.oid) !~* ','
    ) THEN
      RAISE EXCEPTION
        '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_PK) — % PK is not solely (id)', tbl;
    END IF;
  END LOOP;
END $$;

-- ── FK CASCADE (event_reminders.event_id → events(id)) ────────────────────
-- BLOCK on orphans or wrong-shape existing named constraint. Rows preserved.
DO $$
DECLARE
  child_attnum INT2;
  ref_attnum INT2;
  orphan_cnt BIGINT;
  fk_ok BOOLEAN;
BEGIN
  IF to_regclass('public.event_reminders') IS NULL OR to_regclass('public.events') IS NULL THEN
    RAISE EXCEPTION
      '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — FK needs events + event_reminders';
  END IF;

  SELECT a.attnum INTO child_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.event_reminders'::regclass
    AND a.attname = 'event_id' AND NOT a.attisdropped;
  SELECT a.attnum INTO ref_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.events'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.event_reminders'::regclass
      AND c.contype = 'f'
      AND c.conname = 'event_reminders_event_id_fkey'
      AND NOT (
        c.confrelid = 'public.events'::regclass
        AND c.confdeltype = 'c'
        AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
        AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
      )
  ) THEN
    RAISE EXCEPTION
      '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_FK) — event_reminders_event_id_fkey wrong shape (expected CASCADE to events(id))';
  END IF;

  SELECT COUNT(*) INTO orphan_cnt FROM event_reminders r
  WHERE r.event_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id = r.event_id);
  IF orphan_cnt > 0 THEN
    RAISE EXCEPTION
      '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=ORPHAN_FK) — event_reminders has % orphan event_id row(s) referencing events (rows preserved, no delete)',
      orphan_cnt;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.event_reminders'::regclass
      AND c.contype = 'f'
      AND c.conname = 'event_reminders_event_id_fkey'
      AND c.confrelid = 'public.events'::regclass
      AND c.confdeltype = 'c'
      AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
      AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
  ) INTO fk_ok;

  IF NOT fk_ok THEN
    ALTER TABLE event_reminders
      ADD CONSTRAINT event_reminders_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── C/D) idx_events_case_id + idx_events_office_start (ASC, non-unique) ──
-- Global name probe: stolen name / wrong table / UNIQUE / partial / expression
-- / DESC bits / invalid → INCOMPATIBLE_INDEX BLOCK (no DROP INDEX).
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
  asc_ok BOOLEAN;
  opt_i INT;
  expected_cols TEXT[];
  expected_len INT;
BEGIN
  expected_table_oid := to_regclass('public.events');

  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_events_case_id', ARRAY['case_id']::text[],
       'CREATE INDEX IF NOT EXISTS idx_events_case_id ON events (case_id)'),
      ('idx_events_office_start', ARRAY['office_id','start_at']::text[],
       'CREATE INDEX IF NOT EXISTS idx_events_office_start ON events (office_id, start_at)')
    ) AS t(index_name, cols, ddl)
  LOOP
    expected_cols := spec.cols;
    expected_len := cardinality(expected_cols);
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
      asc_ok := true;
      IF index_options IS NULL
         OR cardinality(index_options) IS DISTINCT FROM expected_len THEN
        asc_ok := false;
      ELSE
        FOR opt_i IN 1 .. expected_len LOOP
          IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN asc_ok := false; END IF;
        END LOOP;
      END IF;

      IF actual_table_oid IS DISTINCT FROM expected_table_oid
         OR index_unique IS DISTINCT FROM FALSE
         OR index_partial IS DISTINCT FROM FALSE
         OR index_expression IS DISTINCT FROM FALSE
         OR index_valid IS DISTINCT FROM TRUE
         OR index_ready IS DISTINCT FROM TRUE
         OR index_columns IS DISTINCT FROM expected_cols
         OR asc_ok IS NOT TRUE THEN
        RAISE EXCEPTION
          '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=INCOMPATIBLE_INDEX) — % incompatible (table_oid=% expected_oid=% cols=% opts=%). No DROP INDEX.',
          spec.index_name, actual_table_oid, expected_table_oid, index_columns, index_options;
      END IF;
      -- Exact match already present (020 or prior 047) — leave alone.
    ELSE
      IF expected_table_oid IS NULL THEN
        RAISE EXCEPTION
          '047_calendar: BLOCK_AND_MANUAL_REVIEW (reason_code=MISSING_BASE_TABLE) — index % needs table events',
          spec.index_name;
      END IF;
      EXECUTE spec.ddl;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-apply readiness — must pass before COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  child_attnum INT2;
  ref_attnum INT2;
  spec RECORD;
  index_columns TEXT[];
  index_options INT[];
  asc_ok BOOLEAN;
  opt_i INT;
BEGIN
  IF to_regclass('public.events') IS NULL THEN
    RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — missing table events';
  END IF;
  IF to_regclass('public.event_reminders') IS NULL THEN
    RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — missing table event_reminders';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.events'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — events PK (id) missing or incompatible';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.event_reminders'::regclass AND c.contype='p'
      AND pg_get_constraintdef(c.oid) ~* '\(id\)' AND pg_get_constraintdef(c.oid) !~* ','
  ) THEN
    RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — event_reminders PK (id) missing or incompatible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='office_id'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — events.office_id TEXT NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='start_at'
      AND udt_name='timestamptz' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — events.start_at TIMESTAMPTZ NOT NULL missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='event_type'
      AND udt_name='text' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — events.event_type TEXT NOT NULL missing';
  END IF;

  SELECT a.attnum INTO child_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.event_reminders'::regclass
    AND a.attname = 'event_id' AND NOT a.attisdropped;
  SELECT a.attnum INTO ref_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.events'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.event_reminders'::regclass
      AND c.contype = 'f'
      AND c.conname = 'event_reminders_event_id_fkey'
      AND c.confrelid = 'public.events'::regclass
      AND c.confdeltype = 'c'
      AND array_length(c.conkey, 1) = 1 AND c.conkey[1] = child_attnum
      AND array_length(c.confkey, 1) = 1 AND c.confkey[1] = ref_attnum
  ) THEN
    RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — event_reminders_event_id_fkey CASCADE missing or wrong shape';
  END IF;

  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_events_case_id', ARRAY['case_id']::text[]),
      ('idx_events_office_start', ARRAY['office_id','start_at']::text[])
    ) AS t(index_name, cols)
  LOOP
    SELECT
      (SELECT array_agg(a.attname::text ORDER BY ord.ordinality)
       FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS ord(attnum, ordinality)
       JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ord.attnum AND NOT a.attisdropped),
      (SELECT array_agg(o::int ORDER BY k.ordinality)
       FROM unnest(x.indoption) WITH ORDINALITY AS k(o, ordinality))
    INTO index_columns, index_options
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index x ON x.indrelid = t.oid
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE n.nspname='public' AND t.relname='events' AND i.relname=spec.index_name
      AND x.indisvalid AND x.indisready AND x.indpred IS NULL AND x.indexprs IS NULL
      AND x.indisunique IS DISTINCT FROM TRUE;

    IF index_columns IS NULL THEN
      RAISE EXCEPTION '047_calendar: POST_APPLY_READINESS_FAILED — % missing or wrong binding', spec.index_name;
    END IF;

    asc_ok := true;
    IF index_options IS NULL OR cardinality(index_options) IS DISTINCT FROM cardinality(spec.cols) THEN
      asc_ok := false;
    ELSE
      FOR opt_i IN 1 .. cardinality(spec.cols) LOOP
        IF (index_options[opt_i] & 1) IS DISTINCT FROM 0 THEN asc_ok := false; END IF;
      END LOOP;
    END IF;

    IF index_columns IS DISTINCT FROM spec.cols OR asc_ok IS NOT TRUE THEN
      RAISE EXCEPTION
        '047_calendar: POST_APPLY_READINESS_FAILED — % wrong shape (cols=% opts=%)',
        spec.index_name, index_columns, index_options;
    END IF;
  END LOOP;

  RAISE NOTICE '047_calendar: post-apply FULL READY (reason=CALENDAR_SCHEMA_READY; events; event_reminders; FK CASCADE; idx_events_case_id (case_id ASC); idx_events_office_start (office_id, start_at ASC))';
END $$;

COMMIT;
